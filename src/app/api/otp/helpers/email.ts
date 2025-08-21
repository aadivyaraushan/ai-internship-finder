export const html = (number: string) => `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background-color:#0A0908;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0A0908;">
        <tr>
            <td align="center" style="padding:40px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#7C7C7C; border-radius:24px; box-shadow:0 0 40px rgba(124,124,124,0.43);">
                <tr>
                <td align="center" style="padding:30px 20px;">
                    <h1 style="color:#D7D9CE; font-family:Arial, sans-serif; font-size:32px; margin:0;">
                    Your One-Time Password
                    </h1>
                </td>
                </tr>
                <tr>
                <td align="center" style="padding:20px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding:20px 15px; border-bottom:4px solid #279AF1; text-align:center;">
                        <span style="font-family:Arial, sans-serif; font-size:28px; color:white; font-weight:bold;">
                            ${number[0]}
                        </span>
                        </td>
                        <td style="padding:20px 15px; border-bottom:4px solid #279AF1; text-align:center;">
                        <span style="font-family:Arial, sans-serif; font-size:28px; color:white; font-weight:bold;">
                            ${number[1]}
                        </span>
                        </td>
                        <td style="padding:20px 15px; border-bottom:4px solid #279AF1; text-align:center;">
                        <span style="font-family:Arial, sans-serif; font-size:28px; color:white; font-weight:bold;">
                            ${number[2]}
                        </span>
                        </td>
                        <td style="padding:20px 15px; border-bottom:4px solid #279AF1; text-align:center;">
                        <span style="font-family:Arial, sans-serif; font-size:28px; color:white; font-weight:bold;">
                            ${number[3]}
                        </span>
                        </td>
                    </tr>
                    </table>
                </td>
                </tr>
                <tr>
                <td align="center" style="padding:20px;">
                    <p style="color:#D7D9CE; font-family:Arial, sans-serif; font-size:14px; margin:0;">
                    This code will expire in 5 minutes.
                    </p>
                </td>
                </tr>
            </table>
            </td>
        </tr>
        </table>
    </body>
    </html>

    `