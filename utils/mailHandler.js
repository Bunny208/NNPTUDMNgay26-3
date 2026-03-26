const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "5be2505d139609",
        pass: "0398986feddc95",
    },
});
module.exports = {
    sendMail: async function (to,url) {
        const info = await transporter.sendMail({
            from: 'hehehe@gmail.com',
            to: to,
            subject: "reset password URL",
            text: "click vao day de doi pass", // Plain-text version of the message
            html: "click vao <a href="+url+">day</a> de doi pass", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendUserPasswordMail: async function (to, username, password) {
        const info = await transporter.sendMail({
            from: 'hehehe@gmail.com',
            to: to,
            subject: "Thong tin tai khoan moi",
            text:
                "Tai khoan cua ban da duoc tao.\n" +
                "Username: " + username + "\n" +
                "Password: " + password + "\n" +
                "Vui long dang nhap va doi mat khau som nhat co the.",
            html:
                "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f4f7fb;\">" +
                "<div style=\"background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;\">" +
                "<h2 style=\"margin:0 0 16px;color:#111827;\">Tai khoan cua ban da duoc tao</h2>" +
                "<p style=\"margin:0 0 12px;color:#374151;line-height:1.6;\">He thong da tao tai khoan moi tu file import Excel.</p>" +
                "<div style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:20px 0;\">" +
                "<p style=\"margin:0 0 8px;color:#111827;\"><strong>Username:</strong> " + username + "</p>" +
                "<p style=\"margin:0;color:#111827;\"><strong>Password:</strong> " + password + "</p>" +
                "</div>" +
                "<p style=\"margin:0;color:#6b7280;line-height:1.6;\">Ban nen dang nhap va doi mat khau ngay sau lan dang nhap dau tien.</p>" +
                "</div>" +
                "</div>",
        });

        console.log("Message sent:", info.messageId);
    }
}
