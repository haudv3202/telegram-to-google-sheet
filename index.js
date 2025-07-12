import express from 'express';
import bodyParser from 'body-parser';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { readFile } from 'fs/promises';
import axios from 'axios'; // ⚠️ THÊM DÒNG NÀY Ở ĐẦU FILE nếu chưa có
import { readFile } from 'fs/promises';

const TELEGRAM_TOKEN = '7999263039:AAFMNdCK2Z4d4Yba_j0HecD_IGNNN44n8fs'; // ⚠️ THAY bằng token thật
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

// ==== CẤU HÌNH ==== //
const SPREADSHEET_ID = '1ku7WoIBPNy4NolKQgoFBUqnc9B8jj1NC7DnDM1pYagc';  // Thay bằng ID thực tế
const SHEET_NAME = 'Trang tính1'; // Đúng tên tab
const MSG_ID_COL = 4; // Cột D, message_id (bắt đầu từ 1)
const RESULT_COL = 2; // Cột B, kết quả
const PORT = 3000;

async function main() {
  // const raw = await readFile('credentials.json', 'utf-8');
  // const credentials = JSON.parse(raw);
  const raw = await readFile('/etc/secrets/credentials.json', 'utf-8');
  const credentials = JSON.parse(raw);


  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const app = express();
  app.use(bodyParser.json());

  app.get('/', (req, res) => res.send('Server is running!'));

  app.post('/telegram', async (req, res) => {
    try {
      const data = req.body;
      console.log('\n==== Nhận request Telegram ====');
      // console.log(JSON.stringify(data, null, 2));
      const chatId = data.message?.chat?.id;
      if (data.message?.reply_to_message?.message_id) {
        const replyText = data.message.text || '';
        const replyToMsgId = String(data.message.reply_to_message.message_id);

        // console.log('replyText:', replyText);
        // console.log('replyToMsgId:', replyToMsgId);

        const sheetData = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}`
        });
        // console.log("data",sheetData.data);


        const rows = sheetData.data.values || [];
        // console.log('Sheet has', rows.length, 'rows');

        let foundRow = null;
        for (let i = 1; i < rows.length; i++) {
          // console.log(rows);

          const cellMsgId = rows[i][MSG_ID_COL - 1]?.trim();
          // console.log(`Checking row ${i + 1} - cellMsgId: "${cellMsgId}"`);
          // console.log("rplyToMsgId:", replyToMsgId);
          // console.log(`Comparing "${cellMsgId}" with "${replyToMsgId}"`);

          if (cellMsgId === replyToMsgId) {
            foundRow = i + 1;
            console.log('>>> FOUND at row:', foundRow);
            break;
          }
        }

        if (foundRow) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!${colToLetter(RESULT_COL)}${foundRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[replyText]] }
          });
          console.log(`✅ Đã ghi vào dòng ${foundRow}, cột B: ${replyText}`);
        } else {
          console.log('❌ Không tìm thấy dòng với message_id:', replyToMsgId);
          console.log('Lỗi thường gặp: Chưa lưu đúng message_id vào cột D, hoặc đang reply nhầm message!');
        }
      } else {
        console.log('Không phải reply hoặc thiếu trường reply_to_message.message_id');
        if (chatId) {
          await axios.post(TELEGRAM_API, {
            chat_id: chatId,
            text: '❗ Sai cú pháp. Vui lòng **reply đúng tin nhắn của bot** để gửi kết quả.'
          });
        }


        res.status(200).send('ok');
      }

      res.status(200).send('ok');
    } catch (err) {
      console.error('Error:', err);
      res.status(500).send('error');
    }
  });

  function colToLetter(col) {
    let temp, letter = '';
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = (col - temp - 1) / 26;
    }
    return letter;
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

main().catch(err => console.error('🚨 Startup Error:', err));
