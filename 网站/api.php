<?php
header("Access-Control-Allow-Origin: https://linux.do"); // 允许linux.do访问
header("Content-Type: application/json; charset=UTF-8");

$db = new SQLite3('users.db');

// 初始化数据库
$db->exec("CREATE TABLE IF NOT EXISTS applicants (id INTEGER PRIMARY KEY, username TEXT UNIQUE, status INTEGER DEFAULT 0)");

$action = $_GET['action'] ?? '';

// 1. 用户提交申请
if ($action == 'apply' && $_SERVER['REQUEST_METHOD'] == 'POST') {
    $username = trim($_POST['username'] ?? '');
    if (empty($username)) {
        echo json_encode(['success' => false, 'msg' => '用户名不能为空']);
        exit;
    }

    $stmt = $db->prepare("INSERT OR IGNORE INTO applicants (username) VALUES (:u)");
    $stmt->bindValue(':u', $username, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'msg' => '申请已提交，请等待管理员审核']);
    } else {
        echo json_encode(['success' => false, 'msg' => '提交失败']);
    }
}

// 2. 油猴脚本获取待处理列表
if ($action == 'fetch_pending') {
    $results = $db->query("SELECT username FROM applicants WHERE status = 0");
    $list = [];
    while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
        $list[] = $row['username'];
    }
    echo json_encode(['success' => true, 'usernames' => $list]);
}

// 3. 邀请成功后标记为已处理
if ($action == 'mark_done' && $_SERVER['REQUEST_METHOD'] == 'POST') {
    $usernames = $_POST['usernames'] ?? '';
    if ($usernames) {
        $names = explode(',', $usernames);
        foreach ($names as $name) {
            $stmt = $db->prepare("UPDATE applicants SET status = 1 WHERE username = :u");
            $stmt->bindValue(':u', $name, SQLITE3_TEXT);
            $stmt->execute();
        }
        echo json_encode(['success' => true]);
    }
}
