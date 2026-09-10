import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class SlackService {
  /**
   * If injected via the constructor, the HttpModule module must be imported
   * @private {HttpService}
   */
  private readonly httpService: HttpService = new HttpService();

  /**
   * Send a Slack message
   *
   * @param {string} webhook - Webhook URL
   * @param {string} channel - Slack channel
   * @param {string} text - Message
   * @param {string} token - Slack auth token
   * @return {Promise<{ result: string }>} - Send result
   */
  async sendSlack(
    webhook: string,
    channel: string,
    text: string,
    token: string,
  ): Promise<{ result: string }> {
    const { data } = await firstValueFrom(
      this.httpService.post(
        webhook,
        {
          channel: channel,
          text: text,
        },
        {
          headers: {
            authorization: `Bearer ${token}`,
            'Content-Type': 'application/json;charset=utf8',
          },
        },
      ),
    );
    return { result: data };
  }
}
