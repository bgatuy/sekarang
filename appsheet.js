// ===== AppSheet Extractor (FINAL) =====

// (Opsional) Set worker PDF.js
if (window.pdfjsLib && (!pdfjsLib.GlobalWorkerOptions.workerSrc || pdfjsLib.GlobalWorkerOptions.workerSrc === '')) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

/* ========= SIDEBAR ========= */
const sidebar   = document.querySelector('.sidebar');
const overlay   = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
const sidebarLinks = document.querySelectorAll('.sidebar a');

function openSidebar() { sidebar.classList.add('visible'); overlay?.classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { sidebar.classList.remove('visible'); overlay?.classList.remove('show'); document.body.style.overflow = ''; }
function toggleSidebar() { sidebar.classList.contains('visible') ? closeSidebar() : openSidebar(); }
window.toggleSidebar = toggleSidebar;

overlay?.addEventListener('click', closeSidebar);
document.addEventListener('click', (e) => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;
  const clickInsideSidebar = sidebar.contains(e.target);
  const clickOnToggle = e.target.closest('.sidebar-toggle-btn');
  if (sidebar.classList.contains('visible') && !clickInsideSidebar && !clickOnToggle) closeSidebar();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebar.classList.contains('visible')) closeSidebar(); });
sidebarLinks.forEach(a => a.addEventListener('click', closeSidebar));

document.addEventListener('DOMContentLoaded', function () {
  const title = document.querySelector('.dashboard-header h1')?.textContent?.toLowerCase() || "";
  const body = document.body;
  if (title.includes('trackmate'))      body.setAttribute('data-page', 'trackmate');
  else if (title.includes('appsheet'))  body.setAttribute('data-page', 'appsheet');
  else if (title.includes('serah'))     body.setAttribute('data-page', 'serah');
  else if (title.includes('merge'))     body.setAttribute('data-page', 'merge');
});

/* ========= Query DOM ========= */
const pdfInput     = document.getElementById("pdfFile");
const output       = document.getElementById("output");
const copyBtn      = document.getElementById("copyBtn");
const lokasiSelect = document.getElementById("inputLokasi");

/* ========= Toast ========= */
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  const remove = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); };
  toast.addEventListener('click', remove);
  setTimeout(remove, duration);
}

/* ========= IndexedDB ========= */
const DB_NAME = "PdfStorage";
const DB_VERSION = 1;
const STORE_NAME = "pdfs";
let db;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror   = (e) => reject(e.target.errorCode);
  });
}

async function savePdfToIndexedDB(fileOrBlob, nameOverride) {
  const blob = fileOrBlob instanceof Blob ? fileOrBlob : null;
  if (!blob) throw new Error('savePdfToIndexedDB: harus File/Blob');
  const name = nameOverride || (fileOrBlob.name || '(tanpa-nama)');
  if (blob.type !== 'application/pdf') throw new Error('Type bukan PDF');
  if (!blob.size) throw new Error('PDF kosong');

  const database = await openDb();
  await new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Tx error'));
    tx.objectStore(STORE_NAME).add({
      name,
      dateAdded: new Date().toISOString(),
      data: blob
    });
  });
  console.log(`✅ Tersimpan: ${name} (${(blob.size/1024).toFixed(1)} KB)`);
}

/* ========= State ========= */
let lokasiTerpilih = "", unitKerja = "-", kantor = "-", tanggal = "-", problem = "-",
    berangkat = "-", tiba = "-", mulai = "-", selesai = "-", progress = "-",
    jenis = "-", sn = "-", merk = "-", tipe = "-", pic = "-", status = "-",
    currentFile = null, currentTanggalRaw = "-";

/* ========= Helpers ========= */
function formatTanggalIndo(tanggalStr) {
  const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [dd, mm, yyyy] = tanggalStr.split("/");
  return `${dd} ${bulan[parseInt(mm,10)-1]} ${yyyy}`;
}
function ambil(text, regex, fallback = "-") {
  const match = text.match(regex);
  return match?.[1]?.trim() || fallback;
}
function cleanJam(text) {
  if (!text || text === "-") return "-";
  const match = text.match(/\d{2}[.:]\d{2}/);
  return match ? match[0].replace(/\./g, ":") : "-";
}
function stripLeadingColon(s) { return (s || '').replace(/^\s*:+\s*/, ''); }

/* ========= Output ========= */
function generateLaporan() {
  const unitKerjaLengkap = (lokasiTerpilih && unitKerja !== "-") ? `${unitKerja} (${lokasiTerpilih})` : unitKerja;
  const laporanBaru =
`Selamat Pagi/Siang/Sore Petugas Call Center, Update Pekerjaan

Unit Kerja : ${unitKerjaLengkap}
Kantor Cabang : ${kantor}

Tanggal : ${tanggal}

Jenis Pekerjaan (Problem) : ${problem}

Berangkat : ${berangkat}
Tiba : ${tiba}
Mulai : ${mulai}
Selesai : ${selesai}

Progress : ${progress}

Jenis Perangkat : ${jenis}
Serial Number : ${sn}
Merk Perangkat : ${merk}
Type Perangkat : ${tipe}

PIC : ${pic}
Status : ${status}`;
  output.textContent = laporanBaru;
}

lokasiSelect?.addEventListener("change", () => {
  lokasiTerpilih = lokasiSelect.value;
  generateLaporan();
});

/* ========= File Input ========= */
pdfInput?.addEventListener("change", async () => {
  const file = pdfInput.files[0];
  if (!file) return;
  currentFile = file;

  console.log('🧪 File input:', { name: file.name, type: file.type, size: file.size });
  if (file.type !== 'application/pdf' || !file.size) { alert('File bukan PDF valid.'); return; }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let rawText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    rawText += content.items.map(i => i.str).join(" ") + "\n";
  }
  rawText = rawText.replace(/\s+/g, " ").trim();

  unitKerja = stripLeadingColon(ambil(rawText, /Unit Kerja\s*:\s*(.+?)\s+(Perangkat|Kantor Cabang)/));
  kantor    = ambil(rawText, /Kantor Cabang\s*:\s*(.+?)\s+(Tanggal|Asset ID|Tanggal\/Jam)/);
  const tglRaw = ambil(rawText, /Tanggal\/Jam\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
  currentTanggalRaw = tglRaw;
  tanggal  = tglRaw !== "-" ? formatTanggalIndo(tglRaw) : "-";

  problem  = ambil(rawText, /Trouble Dilaporkan\s*:\s*(.+?)\s+(Solusi|Progress|KETERANGAN)/i);
  if (problem === "-") problem = ambil(rawText, /Problem\s*[:\-]?\s*(.+?)\s+(Solusi|Progress|KETERANGAN)/i);

  berangkat = cleanJam(ambil(rawText, /BERANGKAT\s+(\d{2}[.:]\d{2})/));
  tiba      = cleanJam(ambil(rawText, /TIBA\s+(\d{2}[.:]\d{2})/));
  mulai     = cleanJam(ambil(rawText, /MULAI\s+(\d{2}[.:]\d{2})/));
  selesai   = cleanJam(ambil(rawText, /SELESAI\s+(\d{2}[.:]\d{2})/));

  progress = ambil(rawText, /Solusi\s*\/?\s*Perbaikan\s*:\s*(.+?)\s+(KETERANGAN|Status|$)/i);
  jenis    = ambil(rawText, /Perangkat\s*[:\-]?\s*(.+?)\s+(Kantor Cabang|SN|Asset ID)/i);
  sn       = ambil(rawText, /SN\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
  tipe     = ambil(rawText, /Type\s*[:\-]?\s*([A-Za-z0-9\s\-]+?)(?=\s+(SN|PW|Status|PIC|$))/i);
  merk     = ambil(rawText, /Merk\s*[:\-]?\s*([A-Za-z]+)/i);

  if ((merk === "-" || !merk) && tipe && tipe !== "-") {
    const t = tipe.toUpperCase();
    if (t.includes("LENOVO")) merk = "LENOVO";
    else if (t.includes("DELL")) merk = "DELL";
    else if (t.includes("HP"))   merk = "HP";
    else if (t.includes("ASUS")) merk = "ASUS";
    else if (t.includes("ACER")) merk = "ACER";
    else if (t.includes("AXIOO")) merk = "AXIOO";
    else if (t.includes("MSI"))   merk = "MSI";
    else if (t.includes("ZYREX")) merk = "ZYREX";
  }

  pic    = ambil(rawText, /Pelapor\s*:\s*(.+?)\s+(Type|Status|$)/);
  if (pic.includes("(")) pic = pic.split("(")[0].trim();
  status = ambil(rawText, /Status Pekerjaan\s*:?\s*(Done|Pending|On\s?Progress|Done By Repairing)/i);

  generateLaporan();
});

/* ========= Copy & Save ========= */
copyBtn?.addEventListener("click", async () => {
  const textarea = document.createElement("textarea");
  textarea.value = output.textContent;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  copyBtn.textContent = "✔ Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);

  if (!currentFile || !currentTanggalRaw) return;

  const namaUkerBersih = stripLeadingColon(unitKerja) || '-';
  const histori = JSON.parse(localStorage.getItem("pdfHistori")) || [];
  const key = `${namaUkerBersih}|${currentTanggalRaw}|${currentFile.name}`;
  const isExist = histori.some(x => `${x.namaUker}|${x.tanggalPekerjaan}|${x.fileName}` === key);

  if (!isExist) {
    histori.push({ namaUker: namaUkerBersih, tanggalPekerjaan: currentTanggalRaw, fileName: currentFile.name });
    localStorage.setItem("pdfHistori", JSON.stringify(histori));
    await savePdfToIndexedDB(currentFile); // Simpan File asli
    showToast(`✔ berhasil disimpan ke histori.`);
  } else {
    showToast(`ℹ sudah ada di histori.`);
  }
});
