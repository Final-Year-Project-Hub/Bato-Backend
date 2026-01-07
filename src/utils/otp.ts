import nodemailer from "nodemailer";
import { BadRequestException } from "./root";
import { ErrorCode } from "./root";
import { OtpPurpose } from "@prisma/client";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // false for 587, true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (email: string, otp: string, purpose: OtpPurpose) => {
  const mailOptions = {
    from: `"Bato AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP Code for Email Verification",
    text: `Your OTP code is: ${otp}. It will expire in 2 minutes.`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", email);
  } catch (error: any) {
    console.error("Nodemailer Error:", error);
    // Throw error with message so controller can capture it
    throw error;
  }
};
