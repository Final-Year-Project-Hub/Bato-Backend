import nodemailer from "nodemailer";
import { hashPassword } from "./hash";
import {prisma} from "../lib/prisma.js";
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000, // 10 seconds
  tls: {
    rejectUnauthorized: false, // Avoid disconnection due to SSL certificate issues in some environments
  },
});

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOtpEmail = async (
  email: string,
  otp: string,
  name?: string | null
): Promise<void> => {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: "Your Verification Code",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
            }
            .otp-box {
              background-color: #f4f4f4;
              border: 2px dashed #007bff;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #007bff;
              font-family: 'Courier New', monospace;
            }
            .warning {
              color: #dc3545;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Email Verification</h1>
            <p>Hi ${ name || 'there'},</p>
            <p>Your verification code is:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            
            <p>Enter this code to verify your email address.</p>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            
            <p class="warning">
              ⚠️ If you didn't request this code, please ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
  });
};

export const createAndSendOtp = async (
  userId: string,
  email: string,
  name?: string | null
): Promise<void> => {
  // Generate OTP
  const otp = generateOtp();
  const otpHash = await hashPassword(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store in database
  await prisma.$transaction(async (tx) => {
    // Delete old OTPs for this user
    await tx.otp.deleteMany({
      where: { userId },
    });

    // Create new OTP
    await tx.otp.create({
      data: {
        userId,
        email,
        otp: otpHash,
        expiresAt: otpExpiresAt,
        verified: false,
        attempts: 0,
        purpose: "EMAIL_VERIFICATION",
        type: "EMAIL",
      },
    });
  });

  // Send email
  await sendOtpEmail(email, otp, name);
  console.log(`OTP sent to ${email}`);
};
