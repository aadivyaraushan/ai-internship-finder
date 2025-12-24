export const confirmationHtml = (email: string) => `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background-color:#0f0f0f;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f0f0f;">
        <tr>
            <td align="center" style="padding:40px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:100%; background-color:#1a1a1a; border-radius:16px; border:1px solid #2a2a2a;">
                <tr>
                <td align="center" style="padding:40px 30px 20px;">
                    <div style="width:64px; height:64px; background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius:50%; margin:0 auto 24px; display:flex; align-items:center; justify-content:center;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                        <path d="M20 6L9 17L4 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    </div>
                    <h1 style="color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:28px; margin:0; font-weight:600; line-height:1.2;">
                    Welcome to Refr!
                    </h1>
                </td>
                </tr>
                <tr>
                <td align="center" style="padding:0 40px 20px;">
                    <p style="color:#e5e7eb; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:16px; line-height:1.6; margin:0;">
                    You've been successfully added to our waitlist! 🎉
                    </p>
                </td>
                </tr>
                <tr>
                <td align="center" style="padding:0 40px 30px;">
                    <div style="background-color:#262626; border-radius:12px; padding:20px; border:1px solid #333333;">
                    <p style="color:#9ca3af; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:14px; line-height:1.6; margin:0 0 8px;">
                    We'll notify you at
                    </p>
                    <p style="color:#3b82f6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:15px; font-weight:600; margin:0;">
                    ${email}
                    </p>
                    <p style="color:#9ca3af; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:14px; line-height:1.6; margin:8px 0 0;">
                    when we're ready to launch. Get ready to discover your perfect internship connections!
                    </p>
                    </div>
                </td>
                </tr>
                <tr>
                <td align="center" style="padding:0 40px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                    <tr>
                        <td style="background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius:8px; padding:12px 28px;">
                        <a href="https://refrai.com" style="color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:15px; font-weight:600; text-decoration:none; display:block;">
                            Visit Our Website
                        </a>
                        </td>
                    </tr>
                    </table>
                </td>
                </tr>
                <tr>
                <td align="center" style="padding:24px 40px 32px; border-top:1px solid #262626;">
                    <p style="color:#6b7280; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:13px; line-height:1.5; margin:0;">
                    Questions? Reply to this email or reach out to us at<br/>
                    <a href="mailto:support@refrai.com" style="color:#3b82f6; text-decoration:none;">support@refrai.com</a>
                    </p>
                </td>
                </tr>
            </table>
            </td>
        </tr>
        </table>
    </body>
    </html>
`;
