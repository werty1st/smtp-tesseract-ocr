import { Document, ExternalDocument } from 'pdfjs';
import * as fs from 'fs';

export default class PDFMerger {

  private _doc: Document;

  constructor () {
    this._doc = new Document()
  }

  get doc (): Document {
      return this._doc;
  }

  add (inputFile: fs.PathLike, pages?: string) {
    if (typeof pages === 'undefined' || pages === null) {
      this._addEntireDocument(inputFile)
    } else if (Array.isArray(pages)) {
      this._addGivenPages(inputFile, pages)
    } else if (pages.indexOf(',') > 0) {
      this._addGivenPages(inputFile, pages.replace(/ /g, '').split(',').map( p=>parseInt(p)) )
    } else if (pages.toLowerCase().indexOf('to') >= 0) {
      const span = pages.replace(/ /g, '').split('to')
      this._addFromToPage(inputFile, parseInt(span[0]), parseInt(span[1]))
    } else if (pages.indexOf('-') >= 0) {
      const span = pages.replace(/ /g, '').split('-')
      this._addFromToPage(inputFile, parseInt(span[0]), parseInt(span[1]))
    } else {
      console.error('invalid parameter "pages"')
    }
  }

  _addEntireDocument (inputFile: Buffer | fs.PathLike) {
    const src = (inputFile instanceof Buffer) ? inputFile : fs.readFileSync(inputFile)
    const ext = new ExternalDocument(src)
    this._doc.addPagesOf(ext)
  }

  _addFromToPage (inputFile: Buffer | fs.PathLike, from: number, to: number) {
    if (typeof from === 'number' && typeof to === 'number' && from > 0 && to > from) {
      for (let i = from; i <= to; i++) {
        const src = (inputFile instanceof Buffer) ? inputFile : fs.readFileSync(inputFile)
        const ext = new ExternalDocument(src)
        this._doc.setTemplate(ext)
        this._doc.addPageOf(i, ext)
      }
    } else {
      console.log('invalid function parameter')
    }
  }

  _addGivenPages (inputFile: Buffer | fs.PathLike, pages: number[]) {
    if (pages.length > 0) {
      for (let page in pages) {
        const src = (inputFile instanceof Buffer) ? inputFile : fs.readFileSync(inputFile)
        const ext = new ExternalDocument(src)
        this._doc.setTemplate(ext)
        this._doc.addPageOf(pages[page], ext)
      }
    }
  }

  async save (fileName: fs.PathLike) {
    try {
      const writeStream = this._doc.pipe(fs.createWriteStream(fileName))
      await this._doc.end()

      const writeStreamClosedPromise = new Promise<void>((resolve, reject) => {
        try {
          writeStream.on('close', () => resolve() )
        } catch (e) {
          reject(e)
        }
      })

      return writeStreamClosedPromise
    } catch (error) {
      console.log(error)
    }
  }
}

