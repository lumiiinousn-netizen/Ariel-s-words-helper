// 全局应用状态管理
export const AppState = {
    db: null,           // 数据存储对象（由 main.js 中的 Database 实例注入）
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

// 注入数据库实例
export function setDB(db) {
    AppState.db = db;
    AppState.notify();
}