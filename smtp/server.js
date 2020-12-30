const { spawn, spawnSync } = require('child_process');
const { exec } = require('child_process');

const PDFMerger = require('./pdf-merger');
var stream = require('stream');
const { Readable } = require('stream');
const fs = require('fs');

const SMTPServer = require("smtp-server").SMTPServer;
const nodemailer = require("nodemailer");
const simpleParser = require('mailparser').simpleParser;


const IN_USER = process.env.SMTP_IN_USER   || "";
const IN_PASS = process.env.SMTP_IN_PASS   || "";
const IN_PORT = process.env.PORT           || 25;

const OUT_USER  = process.env.SMTP_OUT_USER || "";
const OUT_PASS  = process.env.SMTP_OUT_PASS || "";
const OUT_HOST  = process.env.SMTP_OUT_HOST || "localhost";
const OUT_PORT  = process.env.SMTP_OUT_PORT || 25;
const OUT_FROM  = process.env.SMTP_OUT_FROM || "";



//forwad modified mail to smtp relay
const transporter = nodemailer.createTransport({
    host: OUT_HOST,
    port: OUT_PORT,
    secure: false, // upgrade later with STARTTLS
    auth: {
      user: OUT_USER,
      pass: OUT_PASS
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
    },
    ignoreTLS: true
  });


async function ocr(tiffs){

    const merger = new PDFMerger();

    //debug only, later pipe to pdf
    const writeStream = fs.createWriteStream('./file1.pdf', { flags: 'w' });

    // "tesseract stdin stdout -l deu+eng --psm 3 --oem 1 pdf"

    for await (const page of tiffs) {
        console.log(`processing page`);

     
        //start process
        const tesseract = spawnSync("tesseract", ["stdin", "stdout", "-l", "deu", "--psm", "3", "--oem", "1", "pdf"], {
                input: page.content,
                encoding: "buffer",
                maxBuffer: 10024*10024, //100MB per page
                timeout: 5000
        });
        
        if (tesseract.status == 0 && !tesseract.error){
            merger.add(tesseract.stdout)
        } else {
            console.log("error during ocr", tesseract.stderr, tesseract.error)
        }

        // tesseract.stdout.on('data', (data) => {
        //     console.log(`stdout: ${data}`);
        // });

        //pipe output to filestream
        //tesseract.stdout.pipe(writeStream);
        //tesseract.stdout.pipe(merger.addPage);


        //pipe input buffer to tesseract
        //tesseract.stdin.pipe();
        //pageStream.pipe(tesseract.stdin);

        // tesseract.stderr.on('data', (data) => {
        //     console.error(`stderr: ${data}`);
        // });

    
        
    };

    //debug
    merger.doc.pipe(writeStream);
    await merger.doc.end();


    //const { stdout, stderr } = await exec('find . -type f | wc -l');
}

//listen for mails from scanner
const server = new SMTPServer({
    //lmtp: true,
    allowInsecureAuth: true,

    onAuth(auth, session, callback) {
        
        if (auth.username !== IN_USER || auth.password !== IN_PASS) {
            console.log("Login failed");
            return callback(new Error("Invalid username or password"));
        }
        console.log("Login successfull");
        callback(null, {user: 123}); // dummy user required
    },

    async onData(stream, session, callback) {
        
        stream.on("end", callback);        
        const mail = await simpleParser(stream);

        // fix to
        mail.to = mail.to.text;
        // fix from
        mail.from =  OUT_FROM!=""?OUT_FROM:mail.from.text;

        // process images
        // filter tiff
        const tifs = mail.attachments.filter( att => att.contentType == "image/tiff" );

        //remove from original array
        tifs.map(f => mail.attachments.splice(
                mail.attachments.findIndex(e => e.name === f.name),1
            )
        );
        

        const pdf = await ocr(tifs)

        //console.log("mail.attachments:", mail.attachments);
        console.log("pdf", pdf);
        

        // var results = await Promise.all(
        //     mail.attachments(async (item) => {
        //         await callAsynchronousOperation(item);
        //         return item + 1;
        //     })
        // );

        return;
        transporter.sendMail(mail, (err, info)=>{
            if (err) {
                console.log("mail failed:", err)
            } else {
                console.log("mail sent:", info)
            }
        })

    }
});

server.listen(IN_PORT, "0.0.0.0", ()=>{console.log(`Listening on Port ${IN_PORT}`)});



