export function escapeHtml(str) {
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

export function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatReviewDate(timestamp) {
    if (!timestamp) return '未安排';
    const date = new Date(timestamp);
    return `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
}

export async function speakEnglishWord(word, accent = 'en-GB') {
    try {
        const voice = accent === 'en-GB' ? 'en-GB-RyanNeural' : 'en-US-JennyNeural';
        const ssml = `<speak><voice name="${voice}">${word}</voice></speak>`;
        const res = await fetch(`https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`, {
            method: 'POST',
            headers: { 'Content-Type':'application/ssml+xml', 'X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3' },
            body: ssml
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => URL.revokeObjectURL(url);
            return;
        }
        throw new Error();
    } catch(e) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = accent === 'en-GB' ? 'en-GB' : 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
}

export async function fetchTranslation(word) {
    if (!word) return null;
    const apis = [
        async () => {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) throw new Error();
            const data = await res.json();
            if (data?.responseData?.translatedText) {
                let t = data.responseData.translatedText.replace(/&#39;/g, "'").replace(/&quot;/g, '"');
                if (t.toLowerCase() !== word.toLowerCase()) return t;
            }
            throw new Error();
        },
        async () => {
            const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh&dt=t&q=${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) throw new Error();
            const data = await res.json();
            if (data?.[0]?.[0]?.[0]) return data[0][0][0];
            throw new Error();
        }
    ];
    for (const api of apis) {
        try { const result = await api(); if (result) return result; } catch { continue; }
    }
    return null;
}

export function detectPartOfSpeech(word) {
    const patterns = [
        { regex: /tion$|sion$/, pos: "n." }, { regex: /ing$/, pos: "v." }, { regex: /ly$/, pos: "adv." },
        { regex: /ful$|ous$|ive$|al$|able$/, pos: "adj." }, { regex: /ize$|ise$/, pos: "v." },
        { regex: /ment$/, pos: "n." }, { regex: /ness$/, pos: "n." }, { regex: /ity$/, pos: "n." }
    ];
    for (let p of patterns) if (p.regex.test(word)) return p.pos;
    return "";
}

function isValidSentence(sentence) {
    if (!sentence || typeof sentence !== 'string') return false;
    const trimmed = sentence.trim();
    if (trimmed.length < 10) return false;
    const lower = trimmed.toLowerCase();
    const forbiddenStart = ["hey","hi","hello","oh","wow","yeah","yes","no","what's up","howdy","greetings","look","listen","well"];
    for (let w of forbiddenStart) if (lower.startsWith(w)) return false;
    if (/hey\W*beautiful/gi.test(trimmed)) return false;
    const foodBlacklist = ["pizza","burger","sandwich","spaghetti","curry","sushi","taco","burrito","noodle","rice","chicken","beef","pork","cake","cookie","ice cream","chocolate","apple pie","steak"];
    for (let f of foodBlacklist) if (lower.includes(f)) return false;
    const verbIndicators = /\b(is|am|are|was|were|be|been|being|have|has|had|having|do|does|did|doing|go|goes|went|gone|make|makes|made|take|takes|took|taken|see|sees|saw|seen|say|says|said|get|gets|got|gotten|find|finds|found|give|gives|gave|given|think|thinks|thought|know|knows|knew|known)\b/i;
    if (!verbIndicators.test(lower) && !/\b\w+ed\b/.test(lower)) return false;
    if (!/\s/.test(trimmed)) return false;
    if (/^[^a-zA-Z0-9'"]/.test(trimmed)) return false;
    return true;
}

export function extractValidExample(data) {
    if (!data || !data[0]) return null;
    const meanings = data[0].meanings;
    if (!meanings) return null;
    for (const meaning of meanings) {
        const definitions = meaning.definitions;
        if (definitions) {
            for (const def of definitions) {
                if (def.example && isValidSentence(def.example)) return def.example;
            }
        }
    }
    return null;
}

export async function fetchOxfordExample(word) {
    if (!word) return null;
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!res.ok) return null;
        const data = await res.json();
        return extractValidExample(data);
    } catch(err) { return null; }
}

export async function exportData(db) {
    const dataStr = JSON.stringify({ wordBank: db.wordBank }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ariels_backup_${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("✅ 数据已导出");
}

export function importData(file, db, onComplete) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.wordBank && Array.isArray(imported.wordBank)) {
                if (confirm("导入将覆盖当前所有单词数据，建议先导出备份。继续？")) {
                    db.wordBank = imported.wordBank;
                    db.save();
                    alert("数据导入成功，请刷新页面");
                    if (onComplete) onComplete();
                    location.reload();
                }
            } else alert("文件格式不正确");
        } catch(err) { alert("解析失败，文件可能已损坏"); }
    };
    reader.readAsText(file);
}