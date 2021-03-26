import { spawnSync } from 'child_process';
import { SMTPServer } from "smtp-server";
import { createTransport } from "nodemailer";
import { simpleParser } from 'mailparser';
import PQueue from "p-queue";
import PDFMerger from'./pdf-merger';


const IN_USER = process.env.SMTP_IN_USER   || "";
const IN_PASS = process.env.SMTP_IN_PASS   || "";
const IN_PORT = parseInt(process.env.PORT || "25");

const OUT_USER  = process.env.SMTP_OUT_USER || "";
const OUT_PASS  = process.env.SMTP_OUT_PASS || "";
const OUT_HOST  = process.env.SMTP_OUT_HOST || "localhost";
const OUT_PORT  = parseInt(process.env.SMTP_OUT_PORT || "25" );
const OUT_FROM  = process.env.SMTP_OUT_FROM || "";
const OUT_VERY  = process.env.SMTP_OUT_VERY==="false"? false: true;
const TIMEOUT   = parseInt(process.env.TIMEOUT || "10000");


const queue = new PQueue({concurrency: 1});

//forwad modified mail to smtp relay
const transporter = createTransport({
    host: OUT_HOST,
    port: OUT_PORT,
    auth: {
      user: OUT_USER,
      pass: OUT_PASS
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: !OUT_VERY
    },
});

function ocr(tiffs: any){

    const merger = new PDFMerger();

    try {
        for (const [index, page] of tiffs.entries()) {
            console.log(`processing page ${index+1} of ${tiffs.length}`);
            
            //start process
            const tesseract = spawnSync("tesseract", ["stdin", "stdout", "-l", "deu", "--psm", "3", "--oem", "1", "pdf"], {
                    input: page.content,
                    encoding: "buffer",
                    maxBuffer: 10024*10024, //100MB per page
                    timeout: 10000
            });

            
            if (tesseract.status == 0 && !tesseract.error){
                merger.add(tesseract.stdout)
            } else {
                console.error("error calling tesseractA", tesseract.stderr.toString("utf8"))
                console.error("error calling tesseractB", tesseract.error)
                return {
                    error: {
                    msg: "error calling tesseract"
                }, pdf: null };
            } 
            
        };
    } catch (error) {
        console.log("tesseract.error2", error)
        return {
            error: {
                msg: "error processing pages",
                stderr: error.msg
            },
            pdf: null };        
    }

    return { error: null, pdf: merger.doc};
}


function job(mail: any){

    // fix to
    mail.to = mail.to.text;
    // fix from
    mail.from =  OUT_FROM!=""?OUT_FROM:mail.from.text;

    // filter tiff
    const tifs = mail.attachments.filter( (att: { contentType: string; }) => att.contentType == "image/tiff" );

    //remove from original array
    tifs.map((f: { name: any; }) => mail.attachments.splice(mail.attachments.findIndex((e: { name: any; }) => e.name === f.name),1));        

    //main job: detect text on images and create searchable pdf => combine single pdfs to one
    const { error, pdf } = ocr(tifs);
    

    if (pdf){
        //add resulting pdf to mail, replacing the tiffs
        mail.attachments.push({
            filename: "scan.pdf",
            content: pdf
        });
        //flush
        pdf.end();
    } else {
        //inform about error
        mail.text = error;
        console.log("no mail", mail);
    }

    transporter.sendMail(mail, (err: any, info: any)=>{
        if (err) {
            console.log("mail failed:", err)
        } else {
            console.log("mail sent:", info)
        }            
    });
}


//listen for mails from scanner
const server = new SMTPServer({
    allowInsecureAuth: true,

    onAuth(auth: any, session: any, callback: any) {
        
        if (auth.username !== IN_USER || auth.password !== IN_PASS) {
            console.log("Login failed");
            return callback(new Error("Invalid username or password"), undefined);
        }
        console.log("Login successfull");
        callback(undefined, {user: 123}); // dummy user required
    },

    async onData(stream: any, session: any, callback: any) {
        
        //if stream is consumed continue
        stream.on("end", callback);  
        
        
        //consume stream
        const mail = await simpleParser(stream);
        
        queue.add( () => job(mail) );
        
        //tesseract cant run in parallel
        //no working solution
        //queue.onIdle().then(()=> server.close() );
    }
});

server.listen(IN_PORT, "0.0.0.0", ()=>{console.log(`Listening on Port ${IN_PORT}`)});



