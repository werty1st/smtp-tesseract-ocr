FROM clearlinux/tesseract-ocr:4

RUN swupd bundle-add nodejs-basic --no-boot-update
ADD models /usr/share/tessdata/.
ADD smtp /app

WORKDIR /app

RUN npm install --only=production

CMD ["npm", "run", "serve"]


#https://github.com/tesseract-ocr/tesseract/blob/master/tessdata/pdf.ttf
#https://github.com/tesseract-ocr/tesseract/blob/master/tessdata/configs/hocr
#https://github.com/tesseract-ocr/tesseract/blob/master/tessdata/configs/txt
#https://github.com/tesseract-ocr/tesseract/blob/master/tessdata/configs/pdf

