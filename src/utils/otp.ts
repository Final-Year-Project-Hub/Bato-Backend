import { hashPassword } from "./hash";
import { google } from "googleapis";
import { prisma } from "../lib/prisma.js";

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.OAUTH_REDIRECT_URI ||
    "https://developers.google.com/oauthplayground"
);
oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

// Validate OAuth2 configuration
const validateOAuth2Config = () => {
  const required = [
    "GMAIL_USER",
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing OAuth2 configuration: ${missing.join(", ")}`);
  }
};

// Helper function to create email in RFC 2822 format
const createEmailMessage = (
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string
): string => {
  const from = process.env.GMAIL_USER;
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="boundary"',
    "",
    "--boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textContent,
    "",
    "--boundary",
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlContent,
    "",
    "--boundary--",
  ];

  const message = messageParts.join("\n");
  // Base64url encode the message
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOtpEmail = async (
  email: string,
  otp: string,
  name?: string | null
): Promise<void> => {
  try {
    validateOAuth2Config();

    // Get fresh access token
    const accessTokenResponse = await oAuth2Client.getAccessToken();
    if (!accessTokenResponse.token) {
      throw new Error("Failed to obtain access token");
    }

    // Set credentials with fresh access token
    oAuth2Client.setCredentials({
      access_token: accessTokenResponse.token,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    // Initialize Gmail API
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const textContent = `Enter ${otp} in the app to verify your email address. This code expires in 10 minutes.`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333;
              background-color: #f9f9f9;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              padding: 20px; 
              background-color: #ffffff;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
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
              padding: 10px;
              background-color: #fff3cd;
              border-radius: 5px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #007bff;">Email Verification</h1>
            </div>
            
            <p>Hi ${name || "there"},</p>
            <p>Your verification code is:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            
            <p>Enter this code to verify your email address.</p>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            
            <div class="warning">
              ⚠️ If you didn't request this code, please ignore this email.
            </div>
            
            <div class="footer">
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const encodedMessage = createEmailMessage(
      email,
      "Your Verification Code",
      htmlContent,
      textContent
    );

    // Send email using Gmail API (uses HTTPS, not SMTP)
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`OTP email sent successfully to ${email} via Gmail API`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error(
      `Failed to send verification email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

export const createAndSendOtp = async (
  userId: string,
  email: string,
  name?: string | null
): Promise<{ status: string; message: string; data: { email: string } }> => {
  try {
    // Generate OTP
    const otp = generateOtp();
    const otpHash = await hashPassword(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in database using transaction
    await prisma.$transaction(async (tx: any) => {
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
    return {
      status: "PENDING",
      message: "Verification OTP email sent",
      data: { email },
    };
  } catch (error) {
    console.error("Error in createAndSendOtp:", error);
    throw new Error(
      `Failed to create and send OTP: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
