// ============================================
// Servidor Academia J.A — guarda el token de GitHub
// de forma segura (nunca queda en el código público)
// ============================================
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// El token se lee de una variable de entorno en Render,
// NUNCA se escribe aquí directamente.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'Thegood2006';
const REPO = 'PROYECTO-SERVICIO-COMUNITARIO';
const BRANCH = 'main';

// Nombres de archivo permitidos (para no dejar escribir cualquier cosa)
const ARCHIVOS_PERMITIDOS = ['contenido.json', 'eventos.json'];
const CARPETAS_PERMITIDAS = ['images/galeria', 'images/eventos'];

if (!GITHUB_TOKEN) {
  console.error('FALTA la variable de entorno GITHUB_TOKEN en Render.');
}

async function ghRequest(path, options = {}) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...options,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      ...(options.headers || {})
    }
  });
}

app.get('/', (req, res) => res.send('Academia J.A backend funcionando ✅'));

// Leer un archivo JSON (contenido.json o eventos.json)
app.get('/api/file/:name', async (req, res) => {
  const name = req.params.name;
  if (!ARCHIVOS_PERMITIDOS.includes(name)) return res.status(400).json({ error: 'Archivo no permitido' });
  try {
    const r = await ghRequest(`contents/${name}?ref=${BRANCH}`);
    if (r.status === 404) return res.json({ sha: null, data: null });
    if (!r.ok) return res.status(r.status).json({ error: 'No se pudo leer el archivo' });
    const json = await r.json();
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    res.json({ sha: json.sha, data: JSON.parse(content) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar un archivo JSON
app.put('/api/file/:name', async (req, res) => {
  const name = req.params.name;
  if (!ARCHIVOS_PERMITIDOS.includes(name)) return res.status(400).json({ error: 'Archivo no permitido' });
  const { data, sha, message, autor } = req.body;
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const body = { message: `${message || 'Actualizar ' + name} (${autor || 'admin'})`, content, branch: BRANCH };
    if (sha) body.sha = sha;
    const r = await ghRequest(`contents/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: 'No se pudo guardar', detail: errText });
    }
    const result = await r.json();
    res.json({ sha: result.content.sha });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Subir una imagen (base64) a una carpeta permitida
app.post('/api/upload', async (req, res) => {
  const { folder, filename, base64, autor } = req.body;
  if (!CARPETAS_PERMITIDAS.includes(folder)) return res.status(400).json({ error: 'Carpeta no permitida' });
  const safeName = (filename || 'archivo').replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;
  try {
    const r = await ghRequest(`contents/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Subir: ${safeName} (${autor || 'admin'})`, content: base64, branch: BRANCH })
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: 'No se pudo subir', detail: errText });
    }
    res.json({ url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Academia J.A corriendo en puerto ${PORT}`));
