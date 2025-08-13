import { NextRequest, NextResponse } from "next/server";
import { RandomPinGenerator } from "node-pin"
import {html} from "./helpers/email"
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import sha256 from "sha256";


type ConnectionRequest = {
    email: string;
}

export async function POST(request: NextRequest) {
    let body: ConnectionRequest = await request.json();

    const {email} = body;

    let pin = await RandomPinGenerator.generate(4);
    console.log(pin);
    let html_format = html("" + pin);

    const mailerSend = new MailerSend({
        apiKey: process.env.MAILERSEND_API_KEY ? process.env.MAILERSEND_API_KEY : "APIKEY", // this'll just throw an error if you dont have your env set
    });

    const sentFrom = new Sender("MS_yGCD61@test-68zxl27zko54j905.mlsender.net", "Refr");

    const recipients = [
        new Recipient(email, email.substring(0, email.indexOf('@')))
    ];
    const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setReplyTo(sentFrom)
    .setSubject("Your Refr OTP")
    .setHtml(html_format);

    await mailerSend.email.send(emailParams);

    return NextResponse.json({pin: sha256(pin)}, {status: 200});
}