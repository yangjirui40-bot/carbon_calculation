"""Bounded invoice rendering shared by OCR and protected source previews."""
import io
import threading
_PDF_LOCK = threading.Lock()  # PDFium must never be entered concurrently.
MAX_PAGES = 10
MAX_PIXELS = 32_000_000

def document_pages(content: bytes):
    from PIL import Image, ImageOps
    if content.startswith(b'%PDF'):
        import pypdfium2 as pdfium
        images=[]
        with _PDF_LOCK:
            pdf=pdfium.PdfDocument(content)
            try:
                if not 1 <= len(pdf) <= MAX_PAGES:
                    raise ValueError('每份PDF须为1—10页；多张独立票据请分开上传')
                pixels=0
                for i in range(len(pdf)):
                    page=pdf[i]
                    try:
                        width,height=page.get_size()
                        if width <= 0 or height <= 0: raise ValueError('PDF页面尺寸无效')
                        pixels += int(width*2)*int(height*2)
                        if pixels > MAX_PIXELS: raise ValueError('PDF渲染像素过多，请降低分辨率或拆分文件')
                        bitmap=page.render(scale=2)
                        try:images.append(bitmap.to_pil().convert('RGB').copy())
                        finally:bitmap.close()
                    finally:page.close()
            except Exception:
                for image in images:image.close()
                raise
            finally:pdf.close()
        return images
    with Image.open(io.BytesIO(content)) as raw:
        if raw.format not in ('PNG','JPEG','WEBP','TIFF','BMP'):
            raise ValueError('仅支持PNG、JPEG、WEBP、TIFF、BMP图像或PDF')
        if raw.width*raw.height > MAX_PIXELS:
            raise ValueError('图片尺寸过大，请压缩后上传')
        return [ImageOps.exif_transpose(raw).convert('RGB').copy()]

def render_preview(content: bytes):
    from PIL import Image
    pages=document_pages(content)
    try:
        width=max(p.width for p in pages);height=sum(p.height for p in pages)
        if width*height > MAX_PIXELS:raise ValueError('预览尺寸过大，请拆分文件')
        canvas=Image.new('RGB',(width,height),'white');offset=0
        try:
            for page in pages:canvas.paste(page,(0,offset));offset+=page.height
            buffer=io.BytesIO();canvas.save(buffer,format='PNG');return buffer.getvalue(), [page.size for page in pages]
        finally:canvas.close()
    finally:
        for page in pages:page.close()


def preview_png(content: bytes) -> bytes:
    return render_preview(content)[0]
