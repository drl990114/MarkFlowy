use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;
use std::time::Duration;

/// 单个文件监听器结构体
pub struct FileWatcher {
    /// 监听器实例
    watcher: Option<RecommendedWatcher>,
    /// 用于停止监听线程的发送器
    stop_sender: Option<Sender<()>>,
    /// 监听线程句柄
    watcher_thread: Option<thread::JoinHandle<()>>,
    /// 监听的路径
    path: Option<String>,
}

impl FileWatcher {
    /// 创建一个新的文件监听器实例
    pub fn new() -> Self {
        FileWatcher {
            watcher: None,
            stop_sender: None,
            watcher_thread: None,
            path: None,
        }
    }

    /// 开始监听指定路径的文件变化
    pub fn watch_path<P: AsRef<Path>, F>(&mut self, path: P, callback: F) -> notify::Result<()>
    where
        F: Fn(notify::Event) + Send + 'static,
    {
        // 如果已经有监听器在运行，先停止它
        self.stop();

        // 保存路径
        self.path = Some(path.as_ref().to_string_lossy().to_string());

        // 创建channel用于接收文件系统事件
        let (tx, rx) = channel();

        // 创建channel用于停止监听线程
        let (stop_tx, stop_rx) = channel();
        self.stop_sender = Some(stop_tx);

        // 创建文件系统监听器
        let mut watcher = RecommendedWatcher::new(
            tx,
            Config::default().with_poll_interval(Duration::from_secs(1)),
        )?;

        // 开始监听指定路径
        watcher.watch(path.as_ref(), RecursiveMode::Recursive)?;
        self.watcher = Some(watcher);

        // 在新线程中处理接收到的事件
        let handle = thread::spawn(move || {
            Self::handle_events(rx, stop_rx, callback);
        });
        self.watcher_thread = Some(handle);

        Ok(())
    }

    /// 处理文件系统事件
    fn handle_events<F>(
        rx: Receiver<notify::Result<notify::Event>>,
        stop_rx: Receiver<()>,
        callback: F,
    ) where
        F: Fn(notify::Event) + Send + 'static,
    {
        loop {
            // 检查是否收到停止信号
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // 尝试接收文件系统事件，设置超时以便定期检查停止信号
            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(res) => match res {
                    Ok(event) => {
                        callback(event);
                    }
                    Err(e) => println!("监听错误: {:?}", e),
                },
                Err(_) => {} // 超时，继续循环检查停止信号
            }
        }
    }

    /// 停止文件监听
    pub fn stop(&mut self) {
        // 发送停止信号
        if let Some(sender) = self.stop_sender.take() {
            let _ = sender.send(());
        }

        // 等待监听线程结束
        if let Some(handle) = self.watcher_thread.take() {
            let _ = handle.join();
        }

        // 清理监听器
        self.watcher = None;
        self.path = None;
    }

    /// 获取监听的路径
    pub fn get_path(&self) -> Option<&String> {
        self.path.as_ref()
    }

    /// 检查监听器是否正在运行
    pub fn is_watching(&self) -> bool {
        self.watcher.is_some()
    }
}

/// 文件监听器管理器，支持通过key管理多个watcher
pub struct FileWatcherManager {
    /// 存储不同key对应的文件监听器
    watchers: HashMap<String, FileWatcher>,
}

impl FileWatcherManager {
    /// 创建一个新的文件监听器管理器
    pub fn new() -> Self {
        FileWatcherManager {
            watchers: HashMap::new(),
        }
    }

    /// 添加或更新指定key的文件监听器
    pub fn watch<P: AsRef<Path>, F>(
        &mut self,
        key: &str,
        path: P,
        callback: F,
    ) -> notify::Result<()>
    where
        F: Fn(notify::Event) + Send + 'static,
    {
        // 获取或创建对应key的监听器
        let watcher = self
            .watchers
            .entry(key.to_string())
            .or_insert_with(FileWatcher::new);
        watcher.watch_path(path, callback)
    }

    /// 停止并移除指定key的文件监听器
    pub fn remove(&mut self, key: &str) -> bool {
        if let Some(mut watcher) = self.watchers.remove(key) {
            watcher.stop();
            true
        } else {
            false
        }
    }

    /// 停止指定key的文件监听器但不移除
    pub fn stop(&mut self, key: &str) -> bool {
        if let Some(watcher) = self.watchers.get_mut(key) {
            watcher.stop();
            true
        } else {
            false
        }
    }

    /// 获取指定key的文件监听器
    pub fn get(&self, key: &str) -> Option<&FileWatcher> {
        self.watchers.get(key)
    }

    /// 获取可变的指定key的文件监听器
    pub fn get_mut(&mut self, key: &str) -> Option<&mut FileWatcher> {
        self.watchers.get_mut(key)
    }

    /// 检查指定key的文件监听器是否存在
    pub fn contains_key(&self, key: &str) -> bool {
        self.watchers.contains_key(key)
    }

    /// 获取所有监听器的key列表
    pub fn keys(&self) -> Vec<String> {
        self.watchers.keys().cloned().collect()
    }

    /// 停止所有文件监听器
    pub fn stop_all(&mut self) {
        for (_, watcher) in self.watchers.iter_mut() {
            watcher.stop();
        }
    }

    /// 清空所有文件监听器
    pub fn clear(&mut self) {
        self.stop_all();
        self.watchers.clear();
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct WatcherEvent {
    key: String,
    paths: Vec<PathBuf>,
}

pub mod cmd {
    use super::{FileWatcherManager, WatcherEvent};
    use lazy_static::lazy_static;
    use std::sync::Mutex;
    use tauri::{command, AppHandle, Emitter, EventTarget, Manager};

    lazy_static! {
        static ref FILE_WATCHER_MANAGER: Mutex<FileWatcherManager> =
            Mutex::new(FileWatcherManager::new());
    }

    #[command]
    pub fn watch_file(
        _app: AppHandle,
        key: &str,
        path: &str,
        window_label: &str,
    ) -> Result<(), String> {
        let app_clone = _app.clone();
        let key_clone = key.to_string();
        let window_label_clone = window_label.to_string();

        println!("Watching file: {} with key: {}", path, key);

        let mut manager = FILE_WATCHER_MANAGER.lock().unwrap();
        manager
            .watch(key, path, move |event: notify::Event| {
                let _ = app_clone.emit_to(
                    EventTarget::labeled(window_label_clone.as_str()),
                    "file_watcher_event",
                    WatcherEvent {
                        key: key_clone.clone(),
                        paths: event.paths.clone(),
                    },
                );
            })
            .map_err(|e| e.to_string())
    }

    #[command]
    pub fn stop_file_watcher(key: &str) -> Result<(), String> {
        let mut manager = FILE_WATCHER_MANAGER.lock().unwrap();
        if manager.remove(key) {
            Ok(())
        } else {
            Err("File watcher not found".to_string())
        }
    }

    #[command]
    pub fn stop_all_file_watchers() -> Result<(), String> {
        let mut manager = FILE_WATCHER_MANAGER.lock().unwrap();
        manager.stop_all();
        Ok(())
    }
}
