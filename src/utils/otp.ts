import nodemailer from "nodemailer";
import { BadRequestException } from "./root";
import { ErrorCode } from "./root";
import { OtpPurpose } from "@prisma/client";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (email: string, otp: string,purpose:OtpPurpose) => {
  const mailOptions = {
    from: `"Bato AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP Code for Email Verification",
    text: `Your OTP code is: ${otp}. It will expire in 2 minutes.`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw new BadRequestException("Error sending email",ErrorCode.EMAIL_SEND_FAILED)
  }
};
