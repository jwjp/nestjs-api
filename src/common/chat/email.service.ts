import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Mail from 'nodemailer/lib/mailer';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { EmailResultDto } from '../../member/dto/member.dto';

@Injectable()
export class EmailService {
  private transporter: Mail;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_USERNAME'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'), // App password
      },
    });
  }

  /**
   * Send an email
   *
   * @param {string} emailAddress - Email address
   * @param {string} subject - Subject
   * @param {string} message - Body (sent as HTML)
   * @return {Promise<object>} - Email send result
   */
  async sendEmail(
    emailAddress: string,
    subject: string,
    message: string,
  ): Promise<EmailResultDto> {
    try {
      const result = await this.transporter.sendMail({
        to: emailAddress,
        subject: subject,
        html: message,
      });

      return {
        accepted: result.accepted, // Successfully sent
        rejected: result.rejected, // Failed to send
        messageTile: result.messageTime as number, // Send time
        messageSize: result.messageSize as number, // Message size
        response: result.response, // Send result message
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        message: err.message,
        stack: err.stack,
      });
    }
  }
}
