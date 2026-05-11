// 全局应用状态管理
export const AppState = {
    db: null,
    currentTab: 'understanding',
    currentGroup: 'all',
    wrongPriority: true,
    useEbbinghaus: true,
    currentAccent: 'en-GB',
    currentQuizIndex: 0,
    spellWordList: [],
    listeners: new Set(),

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    },
    notify() {
        this.listeners.forEach(fn => fn(this));
    },
    setState(updates) {
        Object.assign(this, updates);
        this.notify();
    }
};

export function setDB(db) {
    AppState.db = db;
    AppState.notify();
}