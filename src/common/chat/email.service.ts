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
        pass: this.configService.get<string>('EMAIL_PASSWORD'), // 앱 비밀번호
      },
    });
  }

  /**
   * 이메일 발송
   *
   * @param {string} emailAddress - 이메일 주소
   * @param {string} subject - 제목
   * @param {string} message - 내용 (HTML 옵션으로 발송)
   * @return {Promise<object>} - 이메일 발송 결과
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
        accepted: result.accepted, // 발송 성공
        rejected: result.rejected, // 발송 실패
        messageTile: result.messageTime as number, // 발송 시간
        messageSize: result.messageSize as number, // 메시지 사이즈
        response: result.response, // 발송 결과 메시지
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        message: err.message,
        stack: err.stack,
      });
    }
  }
}
