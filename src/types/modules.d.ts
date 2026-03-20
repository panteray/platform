/* Type declaration shims for packages without @types */

declare module 'fabric' {
  export class Canvas { constructor(el: HTMLCanvasElement | string, options?: any); [key: string]: any }
  export class FabricObject { [key: string]: any }
  export class FabricImage extends FabricObject { static fromURL(url: string, options?: any): Promise<FabricImage>; [key: string]: any }
  export class Rect extends FabricObject { constructor(options?: any) }
  export class Circle extends FabricObject { constructor(options?: any) }
  export class Line extends FabricObject { constructor(points?: number[], options?: any) }
  export class Textbox extends FabricObject { constructor(text: string, options?: any) }
  export class Group extends FabricObject { constructor(objects?: FabricObject[], options?: any) }
  export class Path extends FabricObject { constructor(path: string, options?: any) }
  export class Point { constructor(x: number, y: number); x: number; y: number; [key: string]: any }
  export class ActiveSelection extends FabricObject { constructor(objects?: FabricObject[], options?: any) }
  export class Polyline extends FabricObject { constructor(points?: Array<{x: number; y: number}>, options?: any) }
  export class Polygon extends FabricObject { constructor(points?: Array<{x: number; y: number}>, options?: any) }
  export class FabricText extends FabricObject { constructor(text: string, options?: any) }
  export class Pattern { constructor(options?: any); [key: string]: any }
  export function loadSVGFromString(svg: string): Promise<any>
  export const util: any
}

declare module 'xlsx' {
  export function read(data: any, opts?: any): any
  export function write(wb: any, opts?: any): any
  export const utils: {
    json_to_sheet(data: any[], opts?: any): any
    sheet_to_json<T = any>(sheet: any, opts?: any): T[]
    book_new(): any
    book_append_sheet(wb: any, ws: any, name?: string): void
  }
}

declare module 'pdf-parse' {
  interface PdfParseResult {
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: unknown
    version: string
    text: string
  }
  function pdfParse(buffer: Buffer | ArrayBuffer): Promise<PdfParseResult>
  export default pdfParse
}

declare module 'pdfjs-dist' {
  export function getDocument(data: any): any
  export const GlobalWorkerOptions: any
  export const version: string
}
