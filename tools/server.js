const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const ROOT = path.resolve(__dirname, '..');
const WEB_CARDS = path.join(ROOT, 'web', 'cards');
const WEB_IMG = path.join(ROOT, 'web', 'img');

app.use('/cards', express.static(WEB_CARDS));
app.use('/img', express.static(WEB_IMG));

app.get('/', (req, res) => {
  res.send(`
<h2>Snake Tile Card Generator</h2>
<button onclick="go()">Generate Cards</button>
<div id="status"></div>
<script>
function go(){
 document.getElementById('status').innerText='Generating...';
 fetch('/gen').then(()=>{
   document.getElementById('status').innerText='Done';
   window.location='/cards';
 });
}
</script>
`);
});

app.get('/gen', (req, res) => {
  exec('node tools/generate-cards.js', { cwd: ROOT }, (err) => {
    if (err) return res.status(500).send('Error generating cards');
    res.send('ok');
  });
});

app.get('/cards', (req, res) => {
  const files = fs.readdirSync(WEB_CARDS)
    .filter(f => f.endsWith('.html'))
    .map(f => `<li><a href="/cards/${f}">${f}</a></li>`)
    .join('');
  res.send(`<h2>Cards</h2><ul>${files}</ul>`);
});

app.listen(8081, () => console.log('http://localhost:8081'));
