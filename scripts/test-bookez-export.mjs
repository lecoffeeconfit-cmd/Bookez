import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { base64ToBytes, buildBookHtml, buildBookMarkdown, buildBookText, buildDocx, buildEpub, bytesToBase64 } from '../src/lib/bookez-export.ts';

const decode = new TextDecoder();
const zipEntries = (archive) => {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= archive.length && view.getUint32(offset, true) === 0x04034b50) {
    assert.equal(view.getUint16(offset + 8, true), 0, 'exports use ZIP stored entries');
    const length = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = decode.decode(archive.subarray(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    entries.set(name, archive.subarray(start, start + length));
    offset = start + length;
  }
  return entries;
};

const imageUri = 'file:///cover.png';
const imageBytes = base64ToBytes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6r9t8AAAAASUVORK5CYII=');
const image = { placement: 'cover', title: 'Cover & stars', caption: 'A night sky', uri: imageUri, width: 1, height: 1 };
const asset = { sourceUri: imageUri, path: 'images/image-1.png', mimeType: 'image/png', bytes: imageBytes, width: 1, height: 1 };
const book = {
  title: 'Stars & Ink', authorName: 'A & B', status: 'review', generatedAt: '2026-09-30T00:00:00.000Z',
  frontMatter: [
    { id: 'titlePage', label: 'Title page', content: 'Stars & Ink', included: true, kind: 'front' },
    { id: 'tableOfContents', label: 'Table of contents', content: '', included: true, kind: 'front' },
  ],
  chapters: [
    { key: 'one', title: 'The First Light', content: 'A bright beginning.\nA line break.\n\nThe First Light', words: 9, complete: true, images: [] },
    { key: 'two', title: 'Unwritten', content: '', words: 0, complete: false, images: [] },
    { key: 'three', title: 'The Last Page', content: 'A gentle ending.', words: 3, complete: true, images: [] },
  ],
  backMatter: [], images: [image],
};
const options = { layout: 'book', includeAuthor: true, authorName: 'A & B', includeImages: true, includeCover: true, includePageNumbers: true };

assert.deepEqual(base64ToBytes(bytesToBase64(imageBytes)), imageBytes);
const html = buildBookHtml(book, false, options, { [imageUri]: `data:image/png;base64,${bytesToBase64(imageBytes)}` });
assert.match(html, /src="data:image\/png;base64,/);
assert.doesNotMatch(html, /file:\/\//);
assert.match(html, /id="chapter-3"/);
assert.doesNotMatch(html, /id="chapter-2"/);
assert.doesNotMatch(html, /<h2>Title page<\/h2>/);
assert.doesNotMatch(html, /Early draft|Work in progress/);
assert.match(buildBookText(book, false, options), /Table of contents\n\n1\. The First Light\n2\. The Last Page/);
assert.doesNotMatch(buildBookText(book, false, options), /Work in progress|Exported/);
const markdown = buildBookMarkdown(book, false, options);
assert.doesNotMatch(markdown, /Unwritten|Work in progress|Exported/);
assert.match(markdown, /## The First Light\n\nA bright beginning\.\nA line break\.\n\nThe First Light/);

const epub = zipEntries(buildEpub(book, false, options, [asset]));
assert.equal(decode.decode(epub.get('mimetype')), 'application/epub+zip');
assert.deepEqual(epub.get('OEBPS/images/image-1.png'), imageBytes);
assert.match(decode.decode(epub.get('OEBPS/content.opf')), /properties="cover-image"/);
assert.match(decode.decode(epub.get('OEBPS/content.opf')), /2026-09-30T00:00:00Z/);
assert.match(decode.decode(epub.get('OEBPS/content.xhtml')), /src="images\/image-1\.png"/);
assert.doesNotMatch(decode.decode(epub.get('OEBPS/content.xhtml')), /file:\/\//);
assert.match(decode.decode(epub.get('OEBPS/nav.xhtml')), /content.xhtml#chapter-3/);
assert.doesNotMatch(decode.decode(epub.get('OEBPS/nav.xhtml')), /content.xhtml#chapter-2/);
const epubWithoutImage = zipEntries(buildEpub(book, false, options));
assert.doesNotMatch(decode.decode(epubWithoutImage.get('OEBPS/content.xhtml')), /<img[^>]*src="file:/);

const docx = zipEntries(buildDocx(book, false, options, [asset]));
assert.deepEqual(docx.get('word/media/image-1.png'), imageBytes);
assert.match(decode.decode(docx.get('word/document.xml')), /r:id="rIdFooter"/);
assert.match(decode.decode(docx.get('word/document.xml')), /r:embed="rIdImage1"/);
assert.match(decode.decode(docx.get('word/document.xml')), /A bright beginning\.<\/w:t><w:br\/><w:t xml:space="preserve">A line break\./);
assert.match(decode.decode(docx.get('word/_rels/document.xml.rels')), /Id="rIdFooter"[^>]*Target="footer1.xml"/);
assert.match(decode.decode(docx.get('word/_rels/document.xml.rels')), /Id="rIdImage1"[^>]*Target="media\/image-1.png"/);
assert.doesNotMatch(decode.decode(docx.get('_rels/.rels')), /footer1.xml/);

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'bookez-export-test-'));
try {
  for (const [extension, bytes] of [['epub', buildEpub(book, false, options, [asset])], ['docx', buildDocx(book, false, options, [asset])]]) {
    const file = join(temporaryDirectory, `sample.${extension}`);
    writeFileSync(file, bytes);
    const archiveCheck = spawnSync('unzip', ['-t', file], { encoding: 'utf8' });
    if (archiveCheck.error?.code !== 'ENOENT') assert.equal(archiveCheck.status, 0, archiveCheck.stderr || archiveCheck.stdout);
    for (const [name, content] of zipEntries(bytes)) {
      if (!/\.(xml|xhtml|opf|rels)$/.test(name)) continue;
      const xmlCheck = spawnSync('xmllint', ['--noout', '-'], { input: content, encoding: 'utf8' });
      if (xmlCheck.error?.code !== 'ENOENT') assert.equal(xmlCheck.status, 0, `${name}: ${xmlCheck.stderr}`);
    }
  }
} finally { rmSync(temporaryDirectory, { recursive: true, force: true }); }

process.stdout.write('Book export contract: PDF HTML, EPUB navigation/media, Word media/footer, text filters, and base64 verified.\n');
