export type ExportSection = {
  id: string;
  label: string;
  content: string;
  included: boolean;
  kind: 'front' | 'back';
};

export type ExportChapter = {
  key: string;
  title: string;
  content: string;
  words: number;
  complete: boolean;
  images?: Array<{ placement?: string; title: string; caption?: string; uri?: string; width?: number; height?: number; fullBleed?: boolean }>;
};

export type ExportBook = {
  title: string;
  authorName?: string;
  status: 'draft' | 'review' | 'finished';
  frontMatter: ExportSection[];
  chapters: ExportChapter[];
  backMatter: ExportSection[];
  images?: Array<{ placement?: string; title: string; caption?: string; uri?: string; width?: number; height?: number; fullBleed?: boolean }>;
  generatedAt: string;
};

export type BookExportFormat = 'pdf' | 'txt' | 'md' | 'epub' | 'docx' | 'backup';

export type BookExportLayout = 'book' | 'manuscript' | 'simple';

export type BookExportOptions = {
  layout?: BookExportLayout;
  includeCover?: boolean;
  includeTableOfContents?: boolean;
  includeChapterTitles?: boolean;
  includePageNumbers?: boolean;
  includeImages?: boolean;
  includeAuthor?: boolean;
  authorName?: string;
};

export type ExportImageAsset = {
  sourceUri: string;
  path: string;
  mimeType: 'image/jpeg' | 'image/png';
  bytes: Uint8Array;
  width: number;
  height: number;
};

export type BookezBackup = {
  format: 'bookez-backup';
  version: 1;
  exportedAt: string;
  project: unknown;
  assembledBook: ExportBook;
  contents: {
    chapters: number;
    draftedChapters: number;
    notesIncluded: boolean;
    imagePlacementsIncluded: boolean;
  };
};

export type ExportDescriptor = {
  format: BookExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
};

export const BOOK_EXPORT_FORMATS: ExportDescriptor[] = [
  { format: 'pdf', label: 'PDF', extension: 'pdf', mimeType: 'application/pdf', description: 'Finished book or manuscript' },
  { format: 'docx', label: 'Word', extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: 'Editable document for Word or Docs' },
  { format: 'epub', label: 'EPUB', extension: 'epub', mimeType: 'application/epub+zip', description: 'Ebook file for reading apps' },
  { format: 'txt', label: 'Plain text', extension: 'txt', mimeType: 'text/plain', description: 'A clean, universal text copy' },
  { format: 'md', label: 'Markdown', extension: 'md', mimeType: 'text/markdown', description: 'Structured text for writing tools' },
  { format: 'backup', label: 'Bookez Archive', extension: 'bookez', mimeType: 'application/vnd.bookez.project+json', description: 'Project data archive; image files are not embedded' },
];

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' }[character] ?? character));
const escapeHtml = (value: string) => escapeXml(value).replace(/\n/g, '<br />');
const statusLabel = (status: ExportBook['status']) => status === 'finished' ? 'Finished manuscript' : status === 'review' ? 'Work in progress' : 'Early draft';
const imagePlacement = (image: { placement?: string }) => image.placement ?? 'inline';
const imageLabel = (image: { placement?: string; title: string; caption?: string }) => `[${imagePlacement(image)}: ${image.caption || image.title}]`;
const resolvedExportOptions = (options: BookExportOptions = {}) => ({
  layout: options.layout ?? 'book',
  includeCover: options.includeCover ?? true,
  includeTableOfContents: options.includeTableOfContents ?? true,
  includeChapterTitles: options.includeChapterTitles ?? true,
  includePageNumbers: options.includePageNumbers ?? true,
  includeImages: options.includeImages ?? true,
  includeAuthor: options.includeAuthor ?? Boolean(options.authorName?.trim()),
  authorName: options.authorName?.trim() ?? '',
});

const sectionContent = (section: ExportSection, options: ReturnType<typeof resolvedExportOptions>, book: ExportBook, includeUnfinished: boolean) => {
  if (section.id === 'tableOfContents') return options.includeTableOfContents ? book.chapters.filter((chapter) => includeUnfinished || chapter.content.trim()).map((chapter, index) => `${index + 1}. ${chapter.title}`).join('\n') : '';
  if (section.id === 'titlePage' && options.includeAuthor && options.authorName) return [section.content.trim(), `By ${options.authorName}`].filter(Boolean).join('\n');
  return section.content.trim();
};

const includedFrontMatter = (book: ExportBook, options: ReturnType<typeof resolvedExportOptions>, includeUnfinished: boolean) => book.frontMatter.filter((section) => section.included && section.id !== 'titlePage' && sectionContent(section, options, book, includeUnfinished));
const includedBackMatter = (book: ExportBook) => book.backMatter.filter((section) => section.included && section.content.trim());
const exportImages = (images: Array<{ placement?: string; title: string; caption?: string }> | undefined, options: ReturnType<typeof resolvedExportOptions>) => options.includeImages ? images ?? [] : [];

const renderImageHtml = (image: { placement?: string; title: string; caption?: string; uri?: string; width?: number; height?: number; fullBleed?: boolean }, imageSources?: Record<string, string>) => {
  const sourceUri = image.uri ? (imageSources ? imageSources[image.uri] : image.uri) : undefined;
  const source = sourceUri ? ` src="${escapeXml(sourceUri)}"` : '';
  const dimensions = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
  const visual = source ? `<img${source}${dimensions} alt="${escapeXml(image.caption || image.title)}" />` : `<div class="image-placeholder">${escapeXml(image.title)}</div>`;
  return `<figure class="book-image">${visual}${image.caption ? `<figcaption class="book-caption">${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`;
};

const chapterText = (chapter: ExportChapter, includeUnfinished: boolean, options: ReturnType<typeof resolvedExportOptions>) => {
  const images = exportImages(chapter.images, options);
  const top = images.filter((image) => ['sectionTop', 'chapterOpener'].includes(imagePlacement(image))).map(imageLabel).join('\n');
  const inline = images.filter((image) => !['sectionTop', 'sectionBottom', 'fullPage', 'chapterOpener', 'cover', 'backCover'].includes(imagePlacement(image))).map(imageLabel).join('\n');
  const bottom = images.filter((image) => imagePlacement(image) === 'sectionBottom').map(imageLabel).join('\n');
  const fullPage = images.filter((image) => imagePlacement(image) === 'fullPage').map(imageLabel).join('\n');
  const body = chapter.content.trim();
  if (!body && !includeUnfinished) return '';
  return [options.includeChapterTitles ? chapter.title : '', top, inline, body || '[Not drafted yet — this planned part is included for continuity.]', bottom, fullPage].filter(Boolean).join('\n\n');
};

export function buildBookText(book: ExportBook, includeUnfinished = true, exportOptions: BookExportOptions = {}): string {
  const options = resolvedExportOptions(exportOptions);
  const coverNotes = options.includeCover ? exportImages(book.images, options).filter((image) => imagePlacement(image) === 'cover').map(imageLabel) : [];
  const backCoverNotes = options.includeCover ? exportImages(book.images, options).filter((image) => imagePlacement(image) === 'backCover').map(imageLabel) : [];
  const author = options.includeAuthor && options.authorName ? `By ${options.authorName}` : '';
  const parts = [
    book.title,
    author,
    ...(options.layout === 'manuscript' ? [statusLabel(book.status), `Exported ${new Date(book.generatedAt).toLocaleString()}`] : []),
    ...coverNotes,
    ...includedFrontMatter(book, options, includeUnfinished).map((section) => `${section.label}\n\n${sectionContent(section, options, book, includeUnfinished)}`),
    ...book.chapters.map((chapter) => chapterText(chapter, includeUnfinished, options)).filter(Boolean),
    ...includedBackMatter(book).map((section) => `${section.label}\n\n${section.content.trim()}`),
    ...backCoverNotes,
  ];
  return parts.join('\n\n\n').trim();
}

export function buildBookMarkdown(book: ExportBook, includeUnfinished = true, exportOptions: BookExportOptions = {}): string {
  const options = resolvedExportOptions(exportOptions);
  const coverNotes = options.includeCover ? exportImages(book.images, options).filter((image) => imagePlacement(image) === 'cover').map(imageLabel) : [];
  const backCoverNotes = options.includeCover ? exportImages(book.images, options).filter((image) => imagePlacement(image) === 'backCover').map(imageLabel) : [];
  const author = options.includeAuthor && options.authorName ? `By ${options.authorName}` : '';
  const sections = [
    `# ${book.title}`,
    author,
    ...(options.layout === 'manuscript' ? [`_${statusLabel(book.status)} · Exported ${new Date(book.generatedAt).toLocaleString()}_`] : []),
    ...coverNotes,
    ...includedFrontMatter(book, options, includeUnfinished).map((section) => `## ${section.label}\n\n${sectionContent(section, options, book, includeUnfinished)}`),
    ...book.chapters.map((chapter) => {
      const body = chapterText(chapter, includeUnfinished, options);
      if (!body) return '';
      const copy = options.includeChapterTitles ? body.slice(chapter.title.length).replace(/^\n\n/, '') : body;
      return `${options.includeChapterTitles ? `## ${chapter.title}\n\n` : ''}${copy}`;
    }).filter(Boolean),
    ...includedBackMatter(book).map((section) => `## ${section.label}\n\n${section.content.trim()}`),
    ...backCoverNotes,
  ];
  return sections.join('\n\n').trim() + '\n';
}

export function buildBookHtml(book: ExportBook, includeUnfinished = true, exportOptions: BookExportOptions = {}, imageSources?: Record<string, string>): string {
  const options = resolvedExportOptions(exportOptions);
  const cover = options.includeCover ? exportImages(book.images, options).filter((image) => imagePlacement(image) === 'cover').map((image) => renderImageHtml(image, imageSources)).join('') : '';
  const backCover = options.includeCover ? exportImages(book.images, options).filter((image) => imagePlacement(image) === 'backCover').map((image) => renderImageHtml(image, imageSources)).join('') : '';
  const front = includedFrontMatter(book, options, includeUnfinished).map((section) => `<section class="matter"><h2>${escapeHtml(section.label)}</h2>${sectionContent(section, options, book, includeUnfinished).split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</section>`).join('');
  const chapters = book.chapters.map((chapter, chapterIndex) => {
    const images = exportImages(chapter.images, options);
    const top = images.filter((image) => imagePlacement(image) === 'sectionTop' || imagePlacement(image) === 'chapterOpener').map((image) => renderImageHtml(image, imageSources)).join('');
    const bottom = images.filter((image) => imagePlacement(image) === 'sectionBottom').map((image) => renderImageHtml(image, imageSources)).join('');
    const inline = images.filter((image) => !['sectionTop', 'sectionBottom', 'fullPage', 'chapterOpener', 'cover', 'backCover'].includes(imagePlacement(image))).map((image) => renderImageHtml(image, imageSources)).join('');
    const fullPage = images.filter((image) => imagePlacement(image) === 'fullPage').map((image) => `<div class="full-page">${renderImageHtml(image, imageSources)}</div>`).join('');
    const body = chapter.content.trim();
    if (!body && !includeUnfinished) return '';
    const copy = body || '[Not drafted yet — this planned part is included for continuity.]';
    return `<section class="chapter" id="chapter-${chapterIndex + 1}">${options.includeChapterTitles ? `<h2>${escapeHtml(chapter.title)}</h2>` : ''}${top}${inline}${copy.split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}${bottom}</section>${fullPage}`;
  }).join('');
  const back = includedBackMatter(book).map((section) => `<section class="matter"><h2>${escapeHtml(section.label)}</h2>${section.content.trim().split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</section>`).join('');
  const author = options.includeAuthor && options.authorName ? `<div>By ${escapeHtml(options.authorName)}</div>` : '';
  const exportMeta = options.layout === 'manuscript' ? `<div class="export-meta">${escapeHtml(statusLabel(book.status))} · ${escapeHtml(new Date(book.generatedAt).toLocaleDateString())}</div>` : '';
  const pageNumberCss = options.includePageNumbers ? '@page{@bottom-center{content:counter(page);font-family:Arial,sans-serif;font-size:9pt;color:#89877F}}' : '';
  const layoutCss = options.layout === 'manuscript'
    ? `@page{margin:25.4mm}${pageNumberCss}body{font-family:"Times New Roman",serif;color:#13243D;line-height:2;font-size:12pt}header{text-align:center;margin:18vh 0 36px}h1{font-size:18pt;font-weight:400}.title-rule{display:none}.chapter,.matter{page-break-before:always}h2{font-size:14pt;font-weight:400;margin:0 0 20px}p{margin:0 0 12pt}`
    : options.layout === 'simple'
      ? `@page{margin:18mm}${pageNumberCss}body{font-family:Arial,sans-serif;color:#13243D;line-height:1.55;font-size:11pt}header{text-align:left;margin:24px 0 32px}h1{font-size:25pt;line-height:1.2;margin:0 0 8px}.title-rule{margin:16px 0}.chapter,.matter{margin-top:32px}h2{font-size:16pt;margin:0 0 14px}p{margin:0 0 10px}`
      : `@page{margin:22mm 18mm}${pageNumberCss}body{font-family:Georgia,serif;color:#13243D;line-height:1.65;font-size:11pt}header{text-align:center;padding:16vh 0 10vh;min-height:70vh}h1{font-size:32pt;line-height:1.2;font-weight:400;letter-spacing:-.02em;margin:0 0 18px}.chapter,.matter{page-break-before:always}h2{font-size:20pt;line-height:1.3;font-weight:400;color:#5B1830;text-align:center;margin:42px 0 28px}.chapter p{text-indent:1.2em;margin:0 0 13px}.chapter p:first-of-type{text-indent:0}`;
  const sharedCss = '*{box-sizing:border-box}body{background:#fff}p{white-space:pre-wrap;orphans:2;widows:2}.title-rule{width:72px;height:1px;background:#A47A42;margin:20px auto}.export-meta{font-size:10pt;color:#5E6877;margin-top:12px}.book-image{margin:16px 0;text-align:center;page-break-inside:avoid}.book-image img{display:block;max-width:100%;max-height:58vh;height:auto;object-fit:contain;margin:auto}.full-page{page-break-before:always;page-break-after:always;min-height:80vh;display:flex;align-items:center;justify-content:center}.full-page .book-image{width:100%}.full-page .book-image img{max-height:80vh}.book-caption,.image-placeholder{color:#5E6877;font-size:10pt;font-style:italic;margin-top:7px}';
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(book.title)}</title><style>${layoutCss}${sharedCss}</style></head><body><header><h1>${escapeHtml(book.title)}</h1><div class="title-rule"></div>${author}${exportMeta}${cover}</header>${front}${chapters}${back}${backCover}</body></html>`;
}

function encodeUtf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      }
    }
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(bytes);
}

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

function createZip(files: Array<{ name: string; content: string | Uint8Array }>): Uint8Array {
  const entries = files.map(({ name, content }) => {
    const nameBytes = encodeUtf8(name);
    const data = typeof content === 'string' ? encodeUtf8(content) : content;
    return { nameBytes, data, checksum: crc32(data), localOffset: 0 };
  });
  const localLength = entries.reduce((total, entry) => total + 30 + entry.nameBytes.length + entry.data.length, 0);
  const centralLength = entries.reduce((total, entry) => total + 46 + entry.nameBytes.length, 0);
  if (entries.length > 0xffff || localLength + centralLength + 22 > 0xffffffff) throw new Error('Book export is too large for a ZIP file.');
  const output = new Uint8Array(localLength + centralLength + 22);
  const view = new DataView(output.buffer);
  let offset = 0;
  const write16 = (value: number) => { view.setUint16(offset, value, true); offset += 2; };
  const write32 = (value: number) => { view.setUint32(offset, value, true); offset += 4; };
  const writeBytes = (bytes: Uint8Array) => { output.set(bytes, offset); offset += bytes.length; };
  const date = new Date();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  for (const entry of entries) {
    entry.localOffset = offset;
    write32(0x04034b50); write16(20); write16(0x800); write16(0); write16(dosTime); write16(dosDate);
    write32(entry.checksum); write32(entry.data.length); write32(entry.data.length); write16(entry.nameBytes.length); write16(0);
    writeBytes(entry.nameBytes); writeBytes(entry.data);
  }
  for (const entry of entries) {
    write32(0x02014b50); write16(20); write16(20); write16(0x800); write16(0); write16(dosTime); write16(dosDate);
    write32(entry.checksum); write32(entry.data.length); write32(entry.data.length); write16(entry.nameBytes.length);
    write16(0); write16(0); write16(0); write16(0); write32(0); write32(entry.localOffset); writeBytes(entry.nameBytes);
  }
  write32(0x06054b50); write16(0); write16(0); write16(entries.length); write16(entries.length);
  write32(centralLength); write32(localLength); write16(0);
  return output;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]; const second = bytes[index + 1]; const third = bytes[index + 2];
    output += alphabet[first >> 2];
    output += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    output += second === undefined ? '=' : alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? '=' : alphabet[third & 63];
  }
  return output;
}

export function base64ToBytes(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const encoded = value.replace(/\s/g, '');
  if (encoded.length % 4 !== 0) throw new Error('Invalid image data.');
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((encoded.length / 4) * 3 - padding);
  let offset = 0;
  for (let index = 0; index < encoded.length; index += 4) {
    const a = alphabet.indexOf(encoded[index]);
    const b = alphabet.indexOf(encoded[index + 1]);
    const c = encoded[index + 2] === '=' ? 0 : alphabet.indexOf(encoded[index + 2]);
    const d = encoded[index + 3] === '=' ? 0 : alphabet.indexOf(encoded[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Invalid image data.');
    output[offset++] = (a << 2) | (b >> 4);
    if (encoded[index + 2] !== '=') output[offset++] = ((b & 15) << 4) | (c >> 2);
    if (encoded[index + 3] !== '=') output[offset++] = ((c & 3) << 6) | d;
  }
  return output;
}

const docxParagraph = (text: string, style?: string) => {
  const runs = text.split(/\r?\n/).map((line, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`).join('');
  return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r>${runs}</w:r></w:p>`;
};

const docxImageParagraph = (asset: ExportImageAsset, index: number) => {
  const scale = Math.min(1, 5029200 / (asset.width * 9525), 6858000 / (asset.height * 9525));
  const width = Math.max(9525, Math.round(asset.width * 9525 * scale));
  const height = Math.max(9525, Math.round(asset.height * 9525 * scale));
  const id = index + 1;
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${id}" name="Book image ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Book image ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
};

export function buildDocx(book: ExportBook, includeUnfinished = true, exportOptions: BookExportOptions = {}, imageAssets: ExportImageAsset[] = []): Uint8Array {
  const options = resolvedExportOptions(exportOptions);
  const paragraphs: string[] = [docxParagraph(book.title, 'Title'), ...(options.layout === 'manuscript' ? [docxParagraph(statusLabel(book.status)), docxParagraph(`Exported ${new Date(book.generatedAt).toLocaleDateString()}`)] : [])];
  const assetByUri = new Map(imageAssets.map((asset, index) => [asset.sourceUri, { asset, index }]));
  const appendImage = (image: { placement?: string; title: string; caption?: string; uri?: string }) => {
    const match = image.uri ? assetByUri.get(image.uri) : undefined;
    paragraphs.push(match ? docxImageParagraph(match.asset, match.index) : docxParagraph(imageLabel(image)));
    if (match && image.caption) paragraphs.push(docxParagraph(image.caption, 'Caption'));
  };
  const author = options.includeAuthor && options.authorName ? `By ${options.authorName}` : '';
  if (author) paragraphs.splice(1, 0, docxParagraph(author));
  if (options.includeCover) exportImages(book.images, options).filter((image) => image.placement === 'cover').forEach(appendImage);
  includedFrontMatter(book, options, includeUnfinished).forEach((section) => { paragraphs.push(docxParagraph(section.label, 'Heading1'), ...sectionContent(section, options, book, includeUnfinished).split(/\n+/).map((line) => docxParagraph(line))); });
  book.chapters.forEach((chapter) => {
    const body = chapter.content.trim();
    if (!body && !includeUnfinished) return;
    if (options.includeChapterTitles) paragraphs.push(docxParagraph(chapter.title, 'Chapter'));
    const images = exportImages(chapter.images, options);
    images.filter((image) => ['sectionTop', 'chapterOpener'].includes(imagePlacement(image))).forEach(appendImage);
    images.filter((image) => !['sectionTop', 'sectionBottom', 'fullPage', 'chapterOpener', 'cover', 'backCover'].includes(imagePlacement(image))).forEach(appendImage);
    paragraphs.push(...(body || '[Not drafted yet — this planned part is included for continuity.]').split(/\n\s*\n/).map((part) => docxParagraph(part)));
    images.filter((image) => ['sectionBottom', 'fullPage'].includes(imagePlacement(image))).forEach(appendImage);
  });
  includedBackMatter(book).forEach((section) => { paragraphs.push(docxParagraph(section.label, 'Heading1'), ...section.content.trim().split(/\n+/).map((line) => docxParagraph(line))); });
  if (options.includeCover) exportImages(book.images, options).filter((image) => image.placement === 'backCover').forEach(appendImage);
  const footerReference = options.includePageNumbers ? '<w:footerReference w:type="default" r:id="rIdFooter"/>' : '';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${paragraphs.join('')}<w:sectPr>${footerReference}<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const normalFont = options.layout === 'manuscript' ? 'Times New Roman' : options.layout === 'simple' ? 'Arial' : 'Georgia';
  const normalSpacing = options.layout === 'manuscript' ? '<w:spacing w:line="480" w:lineRule="auto" w:after="240"/>' : '<w:spacing w:after="160"/>';
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr>${normalSpacing}</w:pPr><w:rPr><w:rFonts w:ascii="${normalFont}" w:hAnsi="${normalFont}"/><w:sz w:val="${options.layout === 'manuscript' ? '24' : '22'}"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="300"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="300" w:after="180"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Chapter"><w:name w:val="Chapter"/><w:basedOn w:val="Heading1"/><w:pPr>${options.layout === 'simple' ? '' : '<w:pageBreakBefore/>'}<w:spacing w:before="420" w:after="300"/></w:pPr><w:rPr><w:color w:val="${options.layout === 'manuscript' ? '13243D' : '5B1830'}"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="5E6877"/><w:sz w:val="18"/></w:rPr></w:style></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${options.includePageNumbers ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const imageRelationships = imageAssets.map((asset, index) => `<Relationship Id="rIdImage${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${asset.path.split('/').pop()}"/>`).join('');
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${options.includePageNumbers ? '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ''}${imageRelationships}</Relationships>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>`;
  return createZip([{ name: '[Content_Types].xml', content: contentTypes }, { name: '_rels/.rels', content: rels }, { name: 'word/document.xml', content: documentXml }, { name: 'word/_rels/document.xml.rels', content: documentRels }, { name: 'word/styles.xml', content: stylesXml }, ...(options.includePageNumbers ? [{ name: 'word/footer1.xml', content: footer }] : []), ...imageAssets.map((asset) => ({ name: `word/media/${asset.path.split('/').pop()}`, content: asset.bytes }))]);
}

export function buildEpub(book: ExportBook, includeUnfinished = true, exportOptions: BookExportOptions = {}, imageAssets: ExportImageAsset[] = []): Uint8Array {
  const options = resolvedExportOptions(exportOptions);
  for (const asset of imageAssets) if (!/^images\/[a-zA-Z0-9._-]+$/.test(asset.path)) throw new Error('Invalid EPUB image path.');
  const imageSources = Object.fromEntries(imageAssets.map((asset) => [asset.sourceUri, asset.path]));
  const body = buildBookHtml(book, includeUnfinished, options, imageSources).replace(/^<!DOCTYPE html>/i, '').replace(/<html>.*?<body>/is, '').replace(/<\/body>.*?<\/html>/is, '');
  const identifier = `bookez-${Math.abs(book.title.split('').reduce((total, character) => ((total << 5) - total) + character.charCodeAt(0), 0))}`;
  const container = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  const epubAuthor = options.includeAuthor && options.authorName ? `<dc:creator>${escapeXml(options.authorName)}</dc:creator>` : '';
  const modifiedAt = new Date(book.generatedAt).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const coverUri = options.includeCover ? book.images?.find((image) => imagePlacement(image) === 'cover')?.uri : undefined;
  const imageManifest = imageAssets.map((asset, index) => `<item id="image-${index + 1}" href="${asset.path}" media-type="${asset.mimeType}"${asset.sourceUri === coverUri ? ' properties="cover-image"' : ''}/>`).join('');
  const packageXml = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookez-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookez-id">${identifier}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title>${epubAuthor}<dc:language>en</dc:language><meta property="dcterms:modified">${modifiedAt}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/><item id="style" href="styles.css" media-type="text/css"/>${imageManifest}</manifest><spine><itemref idref="nav" linear="no"/><itemref idref="content"/></spine></package>`;
  const navChapters = book.chapters.map((chapter, index) => includeUnfinished || chapter.content.trim() ? `<li><a href="content.xhtml#chapter-${index + 1}">${escapeXml(chapter.title)}</a></li>` : '').join('');
  const nav = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${escapeXml(book.title)}</title></head><body><nav epub:type="toc" id="toc"><h1>${escapeXml(book.title)}</h1><ol>${navChapters}</ol></nav></body></html>`;
  const content = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(book.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body>${body}</body></html>`;
  const css = options.layout === 'manuscript' ? 'body{font-family:serif;line-height:2;font-size:1em;color:#13243D}h1{text-align:center}h2{break-before:page;font-weight:400}p{white-space:pre-wrap;margin:0 0 1em}' : options.layout === 'simple' ? 'body{font-family:sans-serif;line-height:1.5;color:#13243D}h1{text-align:left}h2{margin-top:2em}p{white-space:pre-wrap;margin:0 0 1em}' : 'body{font-family:serif;line-height:1.65;color:#13243D}h1{text-align:center;font-size:2em}header{padding:12% 0 8%;text-align:center}.chapter{break-before:page}h2{color:#5B1830;font-weight:normal;text-align:center;margin:1.5em 0 1em}p{white-space:pre-wrap;margin:0 0 1em}';
  const sharedCss = '.book-image{text-align:center;margin:1.5em 0;break-inside:avoid}.book-image img{display:block;max-width:100%;height:auto;margin:auto}.book-caption,.image-placeholder{font-size:.85em;color:#5E6877;font-style:italic}.full-page{break-before:page;break-after:page}.matter{break-before:page}';
  return createZip([{ name: 'mimetype', content: 'application/epub+zip' }, { name: 'META-INF/container.xml', content: container }, { name: 'OEBPS/content.opf', content: packageXml }, { name: 'OEBPS/nav.xhtml', content: nav }, { name: 'OEBPS/content.xhtml', content }, { name: 'OEBPS/styles.css', content: css + sharedCss }, ...imageAssets.map((asset) => ({ name: `OEBPS/${asset.path}`, content: asset.bytes }))]);
}

export function buildBookezBackup(book: ExportBook, project: unknown, _exportOptions: BookExportOptions = {}): string {
  const backup: BookezBackup = {
    format: 'bookez-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    assembledBook: book,
    contents: {
      chapters: book.chapters.length,
      draftedChapters: book.chapters.filter((chapter) => chapter.complete).length,
      notesIncluded: true,
      imagePlacementsIncluded: true,
    },
  };
  return JSON.stringify(backup, null, 2);
}
