## Motivation


I wanted to have searchable PDF Scans from my MFP (Scanner).

This Docker Image can be put between a MFP (printer+scanner) and a Mail Provider.

## Workflow

All tiff Image attachements will be processed by [tesseract](https://github.com/tesseract-ocr/tesseract) and then combined to one PDF. The email is then sent to the configured Mail provider without the images but the searchable PDF.

## Usage

Create a docker-compose.yml with the following content:

```yml
version: "2"

services:

  ocr:
    image: smtp-tesseract-ocr
    restart: always
    ports: 
      - "1125:25"
    command: npm run serve
    env_file: .env
    environment: 
      - SMTP_IN_USER=printer         # default: ""
      - SMTP_IN_PASS=printer         # default: ""
      - SMTP_IN_PORT=25              # default: 25
      - SMTP_OUT_HOST=192.168.81.1   # default: localhost
      - SMTP_OUT_PORT=1025           # default: 25
      #- SMTP_OUT_USER=              # default: "" #set in .env
      #- SMTP_OUT_PASS=              # default: "" #set in .env
      #- SMTP_OUT_FROM=              # default: keep original address

```
_Adjust the environment variables as desired._


Launch the service with:

```bash
docker-compose up -d
```

## Remarks

* To reduce complexity I stayed with tiff images. So I could avoid an extra step to extract the images from the PDF the Printer/Scanner sent.

* I didn't have good results with long running nodejs services. So i decided to let docker restart the service after each job.


## Future

* Migrate from clearlinux to a base image that is also available for ARM.
* Adjust language detection based on the Subject
* Modify the Dockerfile so the files inside the ./model directory will be downloaded from their repository during docker build
* Parse the first page as text also, to include it into the mails body.
* use AI to determine the PDFs filename 🤪
