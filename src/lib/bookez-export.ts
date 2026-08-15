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
  status: 'draft' | 'review' | 'finished';
  frontMatter: ExportSection[];
  chapters: ExportChapter[];
  backMatter: ExportSection[];
  images?: Array<{ placement?: string; title: string; caption?: string; uri?: string; width?: number; height?: number; fullBleed?: boolean }>;
  generatedAt: string;
};

export type BookExportFormat = 'pdf' | 'txt' | 'md' | 'html' | 'epub' | 'docx';

export type ExportDescriptor = {
  format: BookExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
};

export const BOOK_EXPORT_FORMATS: ExportDescriptor[] = [
  { format: 'pdf', label: 'PDF', extension: 'pdf', mimeType: 'application/pdf', description: 'Print-ready reading copy' },
  { format: 'docx', label: 'DOCX', extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: 'Editable Word document' },
  { format: 'epub', label: 'EPUB', extension: 'epub', mimeType: 'application/epub+zip', description: 'E-reader book file' },
  { format: 'txt', label: 'Plain text', extension: 'txt', mimeType: 'text/plain', description: 'Universal text copy' },
  { format: 'md', label: 'Markdown', extension: 'md', mimeType: 'text/markdown', description: 'Portable structured text' },
  { format: 'html', label: 'HTML', extension: 'html', mimeType: 'text/html', description: 'Formatted web copy' },
];

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' }[character] ?? character));
const escapeHtml = (value: string) => escapeXml(value).replace(/\n/g, '<br />');
const statusLabel = (status: ExportBook['status']) => status === 'finished' ? 'Finished manuscript' : status === 'review' ? 'Work in progress' : 'Early draft';
const imagePlacement = (image: { placement?: string }) => image.placement ?? 'inline';
const imageLabel = (image: { placement?: string; title: string; caption?: string }) => `[${imagePlacement(image)}: ${image.caption || image.title}]`;
const renderImageHtml = (image: { placement?: string; title: string; caption?: string; uri?: string; width?: number; height?: number; fullBleed?: boolean }) => {
  const source = image.uri ? ` src="${escapeXml(image.uri)}"` : '';
  const dimensions = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
  return `<figure class="book-image"><img${source}${dimensions} alt="${escapeXml(image.caption || image.title)}" />${image.caption ? `<figcaption class="book-caption">${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`;
};

const chapterText = (chapter: ExportChapter, includeUnfinished: boolean) => {
  const images = chapter.images ?? [];
  const top = images.filter((image) => ['sectionTop', 'chapterOpener'].includes(imagePlacement(image))).map(imageLabel).join('\n');
  const inline = images.filter((image) => !['sectionTop', 'sectionBottom', 'fullPage', 'chapterOpener', 'cover', 'backCover'].includes(imagePlacement(image))).map(imageLabel).join('\n');
  const bottom = images.filter((image) => imagePlacement(image) === 'sectionBottom').map(imageLabel).join('\n');
  const fullPage = images.filter((image) => imagePlacement(image) === 'fullPage').map(imageLabel).join('\n');
  const body = chapter.content.trim();
  if (!body && !includeUnfinished) return '';
  return [chapter.title, top, inline, body || '[Not drafted yet — this planned part is included for continuity.]', bottom, fullPage].filter(Boolean).join('\n\n');
};

export function buildBookText(book: ExportBook, includeUnfinished = true): string {
  const coverNotes = (book.images ?? []).filter((image) => imagePlacement(image) === 'cover').map(imageLabel);
  const backCoverNotes = (book.images ?? []).filter((image) => imagePlacement(image) === 'backCover').map(imageLabel);
  const parts = [
    book.title,
    statusLabel(book.status),
    `Exported ${new Date(book.generatedAt).toLocaleString()}`,
    ...coverNotes,
    ...book.frontMatter.filter((section) => section.included && section.content.trim()).map((section) => `${section.label}\n\n${section.content.trim()}`),
    ...book.chapters.map((chapter) => chapterText(chapter, includeUnfinished)).filter(Boolean),
    ...book.backMatter.filter((section) => section.included && section.content.trim()).map((section) => `${section.label}\n\n${section.content.trim()}`),
    ...backCoverNotes,
  ];
  return parts.join('\n\n\n').trim();
}

export function buildBookMarkdown(book: ExportBook, includeUnfinished = true): string {
  const coverNotes = (book.images ?? []).filter((image) => imagePlacement(image) === 'cover').map(imageLabel);
  const backCoverNotes = (book.images ?? []).filter((image) => imagePlacement(image) === 'backCover').map(imageLabel);
  const sections = [
    `# ${book.title}`,
    `_${statusLabel(book.status)} · Exported ${new Date(book.generatedAt).toLocaleString()}_`,
    ...coverNotes,
    ...book.frontMatter.filter((section) => section.included && section.content.trim()).map((section) => `## ${section.label}\n\n${section.content.trim()}`),
    ...book.chapters.map((chapter) => {
      const body = chapterText(chapter, includeUnfinished);
      return body ? `## ${body.replace(/\n\n/g, '\n\n')}` : '';
    }).filter(Boolean),
    ...book.backMatter.filter((section) => section.included && section.content.trim()).map((section) => `## ${section.label}\n\n${section.content.trim()}`),
    ...backCoverNotes,
  ];
  return sections.join('\n\n').trim() + '\n';
}

export function buildBookHtml(book: ExportBook, includeUnfinished = true): string {
  const cover = (book.images ?? []).filter((image) => imagePlacement(image) === 'cover').map((image) => renderImageHtml(image)).join('');
  const backCover = (book.images ?? []).filter((image) => imagePlacement(image) === 'backCover').map((image) => renderImageHtml(image)).join('');
  const front = book.frontMatter.filter((section) => section.included && section.content.trim()).map((section) => `<section class="matter"><h2>${escapeHtml(section.label)}</h2><p>${escapeHtml(section.content.trim())}</p></section>`).join('');
  const chapters = book.chapters.map((chapter) => {
    const top = (chapter.images ?? []).filter((image) => imagePlacement(image) === 'sectionTop' || imagePlacement(image) === 'chapterOpener').map(renderImageHtml).join('');
    const bottom = (chapter.images ?? []).filter((image) => imagePlacement(image) === 'sectionBottom').map(renderImageHtml).join('');
    const inline = (chapter.images ?? []).filter((image) => !['sectionTop', 'sectionBottom', 'fullPage', 'chapterOpener', 'cover', 'backCover'].includes(imagePlacement(image))).map(renderImageHtml).join('');
    const fullPage = (chapter.images ?? []).filter((image) => imagePlacement(image) === 'fullPage').map((image) => `<div class="full-page">${renderImageHtml(image)}</div>`).join('');
    const body = chapterText({ ...chapter, images: [] }, includeUnfinished);
    if (!body) return '';
    const [title, ...content] = body.split('\n\n');
    return `<section class="chapter"><h2>${escapeHtml(title)}</h2>${top}${inline}${content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}${bottom}</section>${fullPage}`;
  }).join('');
  const back = book.backMatter.filter((section) => section.included && section.content.trim()).map((section) => `<section class="matter"><h2>${escapeHtml(section.label)}</h2><p>${escapeHtml(section.content.trim())}</p></section>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(book.title)}</title><style>@page{margin:22mm 18mm}body{font-family:Georgia,serif;color:#202954;line-height:1.6;font-size:16px}h1{text-align:center;font-size:32px;margin:20vh 0 8px}header{text-align:center;color:#6e7699;margin-bottom:40px}.chapter{page-break-before:always}.matter{page-break-before:always}.full-page{page-break-before:always;page-break-after:always;min-height:85vh;display:flex;align-items:center;justify-content:center}h2{font-size:22px;margin-bottom:18px}p{white-space:pre-wrap;margin:0 0 14px}.book-image{margin:12px 0;text-align:center;page-break-inside:avoid}.book-image img{max-width:100%;height:auto;object-fit:contain}.full-page .book-image{width:100%}.full-page .book-image img{max-height:80vh}.book-caption{color:#6e7699;font-size:13px;font-style:italic;margin-top:5px}.missing{color:#6e7699;font-style:italic}</style></head><body><header><h1>${escapeHtml(book.title)}</h1><div>${escapeHtml(statusLabel(book.status))}</div><div>Exported ${escapeHtml(new Date(book.generatedAt).toLocaleString())}</div>${cover}</header>${front}${chapters}${back}${backCover}</body></html>`;
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

const push16 = (output: number[], value: number) => { output.push(value & 0xff, (value >>> 8) & 0xff); };
const push32 = (output: number[], value: number) => { output.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); };

function createZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const output: number[] = [];
  const central: number[] = [];
  let offset = 0;
  const date = new Date();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  files.forEach(({ name, content }) => {
    const nameBytes = encodeUtf8(name);
    const data = encodeUtf8(content);
    const checksum = crc32(data);
    push32(output, 0x04034b50); push16(output, 20); push16(output, 0x800); push16(output, 0); push16(output, dosTime); push16(output, dosDate); push32(output, checksum); push32(output, data.length); push32(output, data.length); push16(output, nameBytes.length); push16(output, 0);
    output.push(...nameBytes, ...data);
    push32(central, 0x02014b50); push16(central, 20); push16(central, 20); push16(central, 0x800); push16(central, 0); push16(central, dosTime); push16(central, dosDate); push32(central, checksum); push32(central, data.length); push32(central, data.length); push16(central, nameBytes.length); push16(central, 0); push16(central, 0); push16(central, 0); push16(central, 0); push32(central, 0); push32(central, offset);
    central.push(...nameBytes);
    offset = output.length;
  });
  const centralOffset = output.length;
  output.push(...central);
  push32(output, 0x06054b50); push16(output, 0); push16(output, 0); push16(output, files.length); push16(output, files.length); push32(output, central.length); push32(output, centralOffset); push16(output, 0);
  return new Uint8Array(output);
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

const docxParagraph = (text: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

export function buildDocx(book: ExportBook, includeUnfinished = true): Uint8Array {
  const paragraphs: string[] = [docxParagraph(book.title, 'Title'), docxParagraph(statusLabel(book.status)), docxParagraph(`Exported ${new Date(book.generatedAt).toLocaleString()}`)];
  (book.images ?? []).filter((image) => image.placement === 'cover').forEach((image) => paragraphs.push(docxParagraph(imageLabel(image))));
  book.frontMatter.filter((section) => section.included && section.content.trim()).forEach((section) => { paragraphs.push(docxParagraph(section.label, 'Heading1'), ...section.content.trim().split(/\n+/).map((line) => docxParagraph(line))); });
  book.chapters.forEach((chapter) => { const body = chapterText(chapter, includeUnfinished); if (!body) return; const [title, ...content] = body.split('\n\n'); paragraphs.push(docxParagraph(title, 'Heading1'), ...content.flatMap((part) => part.split(/\n+/).map((line) => docxParagraph(line)))); });
  book.backMatter.filter((section) => section.included && section.content.trim()).forEach((section) => { paragraphs.push(docxParagraph(section.label, 'Heading1'), ...section.content.trim().split(/\n+/).map((line) => docxParagraph(line))); });
  (book.images ?? []).filter((image) => image.placement === 'backCover').forEach((image) => paragraphs.push(docxParagraph(imageLabel(image))));
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return createZip([{ name: '[Content_Types].xml', content: contentTypes }, { name: '_rels/.rels', content: rels }, { name: 'word/document.xml', content: documentXml }, { name: 'word/styles.xml', content: stylesXml }]);
}

export function buildEpub(book: ExportBook, includeUnfinished = true): Uint8Array {
  const body = buildBookHtml(book, includeUnfinished).replace(/^<!DOCTYPE html>/i, '').replace(/<html>.*?<body>/is, '').replace(/<\/body>.*?<\/html>/is, '');
  const identifier = `bookez-${Math.abs(book.title.split('').reduce((total, character) => ((total << 5) - total) + character.charCodeAt(0), 0))}`;
  const container = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  const packageXml = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookez-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookez-id">${identifier}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">${book.generatedAt}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/><item id="style" href="styles.css" media-type="text/css"/></manifest><spine><itemref idref="nav"/><itemref idref="content"/></spine></package>`;
  const nav = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${escapeXml(book.title)}</title></head><body><nav epub:type="toc" id="toc"><h1>${escapeXml(book.title)}</h1><ol>${book.chapters.map((chapter, index) => `<li><a href="content.xhtml#chapter-${index + 1}">${escapeXml(chapter.title)}</a></li>`).join('')}</ol></nav></body></html>`;
  const content = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(book.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body>${body}</body></html>`;
  const css = 'body{font-family:serif;line-height:1.6}h1{text-align:center}h2{page-break-before:always}p{white-space:pre-wrap}.missing{font-style:italic}';
  return createZip([{ name: 'mimetype', content: 'application/epub+zip' }, { name: 'META-INF/container.xml', content: container }, { name: 'OEBPS/content.opf', content: packageXml }, { name: 'OEBPS/nav.xhtml', content: nav }, { name: 'OEBPS/content.xhtml', content }, { name: 'OEBPS/styles.css', content: css }]);
}
