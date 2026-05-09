import { AppState } from '../app.js';
import { getTodayStr } from './utils.js';

const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];

export function getEbbStatus(item) {
    const now = Date.now();
    const next = item.nextTime || 0;
    if (next === 0) return "新词待复习";
    if (now >= next) return "❗ 立即复习";
    const diff = next - now;
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return hours > 24 ? Math.ceil(hours / 24) + "天后复习" : hours + "小时后复习";
}

export function updateReviewProgress(word, isCorrect) {
    if (!isCorrect) {
        word.reviewStage = 0;
        word.lastReviewDate = getTodayStr();
        word.nextTime = Date.now() + EBBINGHAUS_INTERVALS[0] * 24 * 60 * 60 * 1000;
    } else {
        word.reviewStage = (word.reviewStage === undefined ? 0 : word.reviewStage) + 1;
        word.lastReviewDate = getTodayStr();
        if (word.reviewStage < EBBINGHAUS_INTERVALS.length) {
            const intervalDays = EBBINGHAUS_INTERVALS[word.reviewStage];
            word.nextTime = Date.now() + intervalDays * 24 * 60 * 60 * 1000;
        } else {
            word.nextTime = null; // 已完成所有复习周期
        }
    }
}

export function isDueForReview(word) {
    if (word.reviewStage === undefined) return true;
    if (word.reviewStage >= EBBINGHAUS_INTERVALS.length) return false;
    const next = word.nextTime || 0;
    return next === 0 || next <= Date.now();
}

export function updateSpellList() {
    let filtered = AppState.db.wordBank.filter(w => w.mode === 'spell');
    if (AppState.useEbbinghaus) filtered = filtered.filter(w => isDueForReview(w));
    if (AppState.currentGroup !== 'all') {
        filtered = filtered.filter(w => getWordGroup(w) === AppState.currentGroup);
    }
    if (AppState.wrongPriority) {
        filtered.sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0) || a.id - b.id);
    } else {
        filtered.sort((a, b) => a.id - b.id);
    }
    AppState.spellWordList = filtered;
    if (AppState.currentQuizIndex >= AppState.spellWordList.length) AppState.currentQuizIndex = 0;
    AppState.notify();
}

export function getWordGroup(word) {
    const acc = getWordAccuracy(word);
    if (acc >= 0.8) return 'high';
    if (acc >= 0.6) return 'medium';
    return 'low';
}

export function getWordAccuracy(word) {
    if (!word.attempts || word.attempts === 0) return 1;
    return (word.attempts - (word.wrongCount || 0)) / word.attempts;
}

export function getNextReviewDateStr(word) {
    if (!word.nextTime) return '已完成复习';
    return new Date(word.nextTime).toLocaleString();
}