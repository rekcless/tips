import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ========== FIREBASE CONFIG ========== */
/* Ganti dengan config project mu jika perlu */
const firebaseConfig = {
  apiKey: "AIzaSyCoYxK3aGsq09ahCzVRZ66es_uT1mExO6Q",
  authDomain: "wapblog-6347d.firebaseapp.com",
  projectId: "wapblog-6347d",
  storageBucket: "wapblog-6347d.firebasestorage.app",
  messagingSenderId: "88848578293",
  appId: "1:88848578293:web:a34e495e3a1449c8cf77bc",
  measurementId: "G-H6GVBLR7F5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ========== GLOBALS ========== */
const PIN = "223344";
let isAdmin = false;

const loginBtn = document.getElementById("loginBtn");
const postForm = document.getElementById("postForm");
const judulIn = document.getElementById("judul");
const thumbIn = document.getElementById("thumbnail");
const isiIn = document.getElementById("isi");
const penulisIn = document.getElementById("penulis");
const kirimBtn = document.getElementById("kirim");
const batalBtn = document.getElementById("batal");

const postsDiv = document.getElementById("posts");
const paginationDiv = document.getElementById("pagination");

/* Pagination */
const PER_PAGE = 5;
let allPosts = [];
let currentPage = 1;

/* HELPERS */
function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function formatTime(ts) {
  try {
    if (!ts) return "-";
    if (ts.toDate) return ts.toDate().toLocaleString("id-ID");
    return String(ts);
  } catch {
    return String(ts);
  }
}

/* AUTH */
loginBtn.addEventListener("click", () => {
  const pin = prompt("Masukkan PIN admin:");
  if (pin === PIN) {
    isAdmin = true;
    postForm.classList.remove("hidden");
    loginBtn.innerText = "🔓 Admin (ON)";
    loginBtn.disabled = true;
    loadAllPosts();
    alert("✅ Admin aktif");
  } else {
    alert("❌ PIN salah");
  }
});

/* CREATE */
kirimBtn.addEventListener("click", async () => {
  if (!isAdmin) return alert("Masuk admin dulu (PIN).");
  const judul = judulIn.value.trim();
  const isi = isiIn.value.trim();
  const penulis = penulisIn.value.trim();
  const thumb = thumbIn.value.trim();
  if (!judul || !isi || !penulis) return alert("Isi semua kolom (judul, isi, penulis).");

  try {
    await addDoc(collection(db, "posting"), {
      judul,
      isi,
      penulis,
      thumbnail: thumb || null,
      waktu: serverTimestamp()
    });
    judulIn.value = ""; isiIn.value = ""; penulisIn.value = ""; thumbIn.value = "";
    alert("✅ Post terkirim");
    await loadAllPosts();
    goToPage(1);
  } catch (e) {
    console.error(e);
    alert("❌ Gagal kirim ke Firestore");
  }
});

batalBtn.addEventListener("click", () => {
  judulIn.value = ""; thumbIn.value = ""; isiIn.value = ""; penulisIn.value = "";
});

/* LOAD ALL POSTS (newest first) */
async function loadAllPosts() {
  postsDiv.innerHTML = "<p>Memuat...</p>";
  try {
    const q = query(collection(db, "posting"), orderBy("waktu", "desc"));
    const snap = await getDocs(q);
    allPosts = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    // sort safe fallback
    allPosts.sort((a,b) => {
      const ta = a.data.waktu && a.data.waktu.toDate ? a.data.waktu.toDate().getTime() : 0;
      const tb = b.data.waktu && b.data.waktu.toDate ? b.data.waktu.toDate().getTime() : 0;
      return tb - ta;
    });
    renderPageNumbers();
    renderPostsForPage(currentPage);
  } catch (e) {
    console.error(e);
    postsDiv.innerHTML = "<p>Gagal memuat postingan.</p>";
  }
}

/* RENDER FOR PAGE */
function renderPostsForPage(page = 1) {
  postsDiv.innerHTML = "";
  const total = allPosts.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  currentPage = page;
  const start = (page - 1) * PER_PAGE;
  const slice = allPosts.slice(start, start + PER_PAGE);

  if (slice.length === 0) {
    postsDiv.innerHTML = "<p>Belum ada postingan.</p>";
    return;
  }

  slice.forEach(item => {
    const d = item.data;
    const title = escapeHtml(d.judul || "Tanpa Judul");
    const penulis = escapeHtml(d.penulis || "Anonim");
    const waktu = formatTime(d.waktu) || "-";
    const preview = escapeHtml((d.isi || "").slice(0, 220)) + ((d.isi && d.isi.length > 220) ? "..." : "");
    const thumbUrl = d.thumbnail || "";

    // create article element
    const art = document.createElement("article");
    art.className = "post";

    const thumbHtml = thumbUrl ? `<img class="post-thumb" src="${escapeHtml(thumbUrl)}" alt="thumb">` : `<div class="post-thumb" style="display:flex;align-items:center;justify-content:center;color:#9e9e9e;font-size:12px;">No img</div>`;

    art.innerHTML = `
      ${thumbHtml}
      <div class="post-body">
        <h3 class="post-title">${title}</h3>
        <div class="meta">✍️ ${penulis} — ${waktu}</div>
        <p class="preview">${preview}</p>
        <div class="controls">
          <button class="read">Baca Selengkapnya</button>
          ${isAdmin ? `<button class="edit">Edit</button><button class="del">Hapus</button>` : ""}
        </div>
      </div>
    `;

    // events
    art.querySelector(".read").addEventListener("click", () => {
      openReadModal(d.judul, d.isi, d.penulis, d.waktu, d.thumbnail);
    });

    if (isAdmin) {
      art.querySelector(".del").addEventListener("click", async () => {
        if (!confirm("Yakin hapus postingan ini?")) return;
        try {
          await deleteDoc(doc(db, "posting", item.id));
          alert("🗑️ Dihapus");
          await loadAllPosts();
        } catch (e) { console.error(e); alert("Gagal hapus"); }
      });

      art.querySelector(".edit").addEventListener("click", () => openEditModal(item.id, d));
    }

    postsDiv.appendChild(art);
  });

  renderPageNumbers();
}

/* PAGINATION UI */
function renderPageNumbers() {
  paginationDiv.innerHTML = "";
  const total = allPosts.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "pageNum" + (i === currentPage ? " active" : "");
    btn.innerText = i;
    btn.addEventListener("click", () => {
      goToPage(i);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    paginationDiv.appendChild(btn);
  }
}
function goToPage(n){ currentPage = n; renderPostsForPage(n); }

/* READ MODAL */
const modalRead = document.getElementById("modalRead");
const modalReadContent = modalRead.querySelector(".modal-content");
const modalReadTitle = document.getElementById("modalReadTitle");
const modalReadMeta = document.getElementById("modalReadMeta");
const modalReadThumb = document.getElementById("modalReadThumb");
const modalReadBody = document.getElementById("modalReadBody");
const closeRead = document.getElementById("closeRead");

function openReadModal(judul, isi, penulis, waktu, thumb){
  modalReadTitle.innerText = judul || "";
  modalReadMeta.innerText = `✍️ ${penulis || "Anonim"} — ${formatTime(waktu)}`;
  modalReadBody.innerText = isi || "";
  if (thumb) { modalReadThumb.src = thumb; modalReadThumb.classList.remove("hidden"); } else modalReadThumb.classList.add("hidden");
  modalRead.classList.remove("hidden");
}
closeRead.addEventListener("click", ()=> modalRead.classList.add("hidden"));
modalRead.addEventListener("click", (e)=> { if (!modalReadContent.contains(e.target)) modalRead.classList.add("hidden"); });

/* EDIT MODAL (fade-in) */
const modalEdit = document.getElementById("modalEdit");
const modalEditContent = modalEdit.querySelector(".modal-content");
const editJudul = document.getElementById("editJudul");
const editThumbnail = document.getElementById("editThumbnail");
const editIsi = document.getElementById("editIsi");
const editPenulis = document.getElementById("editPenulis");
const saveEdit = document.getElementById("saveEdit");
const cancelEdit = document.getElementById("cancelEdit");

let editingId = null;

function openEditModal(id, data){
  editingId = id;
  editJudul.value = data.judul || "";
  editThumbnail.value = data.thumbnail || "";
  editIsi.value = data.isi || "";
  editPenulis.value = data.penulis || "";
  modalEdit.classList.remove("hidden");
  editJudul.focus();
}
cancelEdit.addEventListener("click", ()=> { editingId=null; modalEdit.classList.add("hidden"); });
modalEdit.addEventListener("click", (e)=> { if (!modalEditContent.contains(e.target)) { editingId=null; modalEdit.classList.add("hidden"); } });

saveEdit.addEventListener("click", async () => {
  if (!isAdmin) return alert("Hanya admin!");
  if (!editingId) return;
  const newJudul = editJudul.value.trim();
  const newIsi = editIsi.value.trim();
  const newPenulis = editPenulis.value.trim();
  const newThumb = editThumbnail.value.trim() || null;
  if (!newJudul || !newIsi || !newPenulis) return alert("Semua field harus terisi.");
  try {
    await updateDoc(doc(db, "posting", editingId), {
      judul: newJudul,
      isi: newIsi,
      penulis: newPenulis,
      thumbnail: newThumb
    });
    alert("✏️ Postingan diperbarui");
    editingId = null;
    modalEdit.classList.add("hidden");
    await loadAllPosts();
  } catch (e) {
    console.error(e); alert("Gagal menyimpan edit");
  }
});

/* START */
loadAllPosts();