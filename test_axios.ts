
import axios from 'axios';
const api = axios.create({ headers: { 'Content-Type': 'application/json' } });
const fd = new FormData();
fd.append('file', new Blob(['test']), 'test.txt');

import * as http from 'http';
const server = http.createServer((req, res) => {
  console.log('RECEIVED CONTENT-TYPE:', req.headers['content-type']);
  res.end('ok');
});
server.listen(8002, () => {
  api.post('http://localhost:8002', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then(() => server.close())
    .catch(() => server.close());
});

