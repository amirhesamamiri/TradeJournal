
// =====================================
// 1. تنظیمات و ایجاد دیتابیس
// =====================================

const DB_NAME = "TradeJournalDB";
const DB_VERSION = 1;

let db;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function (event) {
            const database = event.target.result;

            if (!database.objectStoreNames.contains("trades")) {
                database.createObjectStore("trades", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }

            if (!database.objectStoreNames.contains("notes")) {
                database.createObjectStore("notes", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = function () {
            db = request.result;
            resolve(db);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}


// =====================================
// 2. توابع عمومی دیتابیس
// =====================================

function saveData(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        const request = store.add(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllData(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);

        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteData(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}


// =====================================
// 3. توابع کمکی
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function today() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatMoney(value) {
    return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " $";
}


// =====================================
// 4. نمایش صفحات
// =====================================

async function showPage(page) {
    const content = document.getElementById("pageContent");

    if (!content) return;

    if (page === "home") {
        content.innerHTML = "";
        await updateDashboard();
    }

    if (page === "add") {
        showAddForm();
    }

    if (page === "history") {
        await showHistory();
    }

    if (page === "notes") {
        await showNotes();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// =====================================
// 5. فرم ثبت معامله
// =====================================

function showAddForm() {
    const content = document.getElementById("pageContent");

    content.innerHTML = `
        <div class="app-section">

            <h3>ثبت معامله جدید</h3>

            <form id="tradeForm">

                <label>نماد معاملاتی</label>
                <input type="text" id="symbol"
                    placeholder="مثلاً EURUSD" required>

                <label>نوع معامله</label>
                <select id="direction" required>
                    <option value="BUY">خرید (BUY)</option>
                    <option value="SELL">فروش (SELL)</option>
                </select>

                <label>تاریخ معامله</label>
                <input type="date" id="tradeDate"
                    value="${today()}" required>

                <label>قیمت ورود</label>
                <input type="number" id="entry"
                    step="any" min="0" required>

                <label>قیمت خروج</label>
                <input type="number" id="exit"
                    step="any" min="0" required>

                <label>حد ضرر</label>
                <input type="number" id="stopLoss"
                    step="any" min="0">

                <label>حد سود</label>
                <input type="number" id="takeProfit"
                    step="any" min="0">

                <label>حجم معامله (Lot)</label>
                <input type="number" id="volume"
                    step="any" min="0" required>

                <label>نتیجه نهایی معامله (دلار)</label>
                <input type="number" id="result"
                    step="any" placeholder="مثلاً 25 یا -15"
                    required>

                <label>استراتژی معاملاتی</label>
                <input type="text" id="strategy"
                    placeholder="مثلاً Breakout">

                <label>توضیحات</label>
                <textarea id="description"
                    rows="4" placeholder="توضیحات معامله..."></textarea>

                <button type="submit">ذخیره معامله</button>

            </form>

        </div>
    `;

    document.getElementById("tradeForm")
        .addEventListener("submit", saveTrade);
}


// =====================================
// 6. ذخیره معامله
// =====================================

async function saveTrade(event) {
    event.preventDefault();

    const trade = {
        symbol: document.getElementById("symbol").value.trim().toUpperCase(),
        direction: document.getElementById("direction").value,
        date: document.getElementById("tradeDate").value,
        entry: Number(document.getElementById("entry").value),
        exit: Number(document.getElementById("exit").value),
        stopLoss: Number(document.getElementById("stopLoss").value) || 0,
        takeProfit: Number(document.getElementById("takeProfit").value) || 0,
        volume: Number(document.getElementById("volume").value),
        result: Number(document.getElementById("result").value),
        strategy: document.getElementById("strategy").value.trim(),
        description: document.getElementById("description").value.trim(),
        createdAt: new Date().toISOString()
    };

    if (!trade.symbol || !trade.date ||
        !Number.isFinite(trade.entry) ||
        !Number.isFinite(trade.exit) ||
        !Number.isFinite(trade.volume) ||
        !Number.isFinite(trade.result) ||
        trade.entry <= 0 || trade.exit <= 0 ||
        trade.volume <= 0) {

        alert("لطفاً اطلاعات معامله را به‌درستی وارد کن.");
        return;
    }

    try {
        await saveData("trades", trade);

        alert("معامله با موفقیت ثبت شد.");

        await showPage("home");

    } catch (error) {
        console.error(error);
        alert("خطا در ذخیره معامله!");
    }
}


// =====================================
// 7. نمایش تاریخچه معاملات
// =====================================

async function showHistory() {
    const content = document.getElementById("pageContent");
    const trades = await getAllData("trades");

    let html = `
        <div class="app-section">
            <h3>تاریخچه معاملات</h3>
    `;

    if (trades.length === 0) {
        html += "<p>هنوز معامله‌ای ثبت نشده است.</p>";
    }

    trades.sort((a, b) => b.id - a.id);

    trades.forEach(trade => {
        const profitClass = trade.result > 0
            ? "profit"
            : trade.result < 0
                ? "loss"
                : "";

        html += `
            <div class="trade-item">

                <h4>${escapeHTML(trade.symbol)}</h4>

                <p>نوع: ${trade.direction}</p>
                <p>تاریخ: ${escapeHTML(trade.date)}</p>
                <p>ورود: ${trade.entry}</p>
                <p>خروج: ${trade.exit}</p>
                <p>حجم: ${trade.volume}</p>

                <p class="${profitClass}">
                    نتیجه: ${formatMoney(trade.result)}
                </p>

                <p>استراتژی: ${escapeHTML(trade.strategy)}</p>

                <p>${escapeHTML(trade.description)}</p>

                <button onclick="removeTrade(${trade.id})">
                    حذف معامله
                </button>

            </div>
        `;
    });

    html += "</div>";

    content.innerHTML = html;
}


// =====================================
// 8. حذف معامله
// =====================================

async function removeTrade(id) {
    if (!confirm("آیا از حذف این معامله مطمئن هستی؟")) {
        return;
    }

    try {
        await deleteData("trades", id);
        await showHistory();
        await updateDashboard();

    } catch (error) {
        console.error(error);
        alert("حذف معامله انجام نشد.");
    }
}


// =====================================
// 9. به‌روزرسانی داشبورد
// =====================================

async function updateDashboard() {
    const trades = await getAllData("trades");

    const total = trades.length;

    const winning = trades.filter(t => t.result > 0).length;
    const losing = trades.filter(t => t.result < 0).length;

    const totalProfit = trades.reduce(
        (sum, trade) => sum + trade.result, 0
    );

    const winRate = total > 0
        ? (winning / total) * 100
        : 0;

    document.getElementById("totalTrades").textContent = total;

    document.getElementById("winningTrades").textContent = winning;

    document.getElementById("losingTrades").textContent = losing;

    document.getElementById("winRate").textContent =
        winRate.toFixed(1) + "%";

    const profitElement = document.getElementById("totalProfit");

    profitElement.textContent = formatMoney(totalProfit);

    profitElement.style.color =
        totalProfit >= 0 ? "#16a34a" : "#dc2626";
}


// =====================================
// 10. یادداشت های معاملاتی
// =====================================

async function showNotes() {
    const content = document.getElementById("pageContent");
    const notes = await getAllData("notes");

    let html = `
        <div class="app-section">

            <h3>یادداشت‌های معاملاتی</h3>

            <form id="noteForm">

                <label>عنوان یادداشت</label>
                <input type="text" id="noteTitle"
                    placeholder="عنوان یادداشت" required>

                <label>متن یادداشت</label>
                <textarea id="noteText"
                    rows="5" placeholder="یادداشت خود را بنویس..."
                    required></textarea>

                <button type="submit">ذخیره یادداشت</button>

            </form>

            <h3>یادداشت‌های ذخیره‌شده</h3>
    `;

    notes.sort((a, b) => b.id - a.id);

    if (notes.length === 0) {
        html += "<p>هنوز یادداشتی ثبت نشده است.</p>";
    }

    notes.forEach(note => {
        html += `
            <div class="trade-item">
                <h4>${escapeHTML(note.title)}</h4>
                <p>${escapeHTML(note.text)}</p>

                <button onclick="removeNote(${note.id})">
                    حذف یادداشت
                </button>
            </div>
        `;
    });

    html += "</div>";

    content.innerHTML = html;

    document.getElementById("noteForm")
        .addEventListener("submit", saveNote);
}


// =====================================
// 11. ذخیره و حذف یادداشت
// =====================================

async function saveNote(event) {
    event.preventDefault();

    const title = document.getElementById("noteTitle").value.trim();
    const text = document.getElementById("noteText").value.trim();

    if (!title || !text) return;

    try {
        await saveData("notes", {
            title,
            text,
            date: new Date().toISOString()
        });

        await showNotes();

    } catch (error) {
        console.error(error);
        alert("خطا در ذخیره یادداشت!");
    }
}

async function removeNote(id) {
    if (!confirm("یادداشت حذف شود؟")) return;

    try {
        await deleteData("notes", id);
        await showNotes();

    } catch (error) {
        console.error(error);
        alert("حذف یادداشت انجام نشد.");
    }
}


// =====================================
// 12. شروع برنامه
// =====================================

document.addEventListener("DOMContentLoaded", async function () {
    try {
        await openDatabase();
        await updateDashboard();

    } catch (error) {
        console.error(error);
        alert("دیتابیس باز نشد. لطفاً مرورگر را بررسی کن.");
    }
});
