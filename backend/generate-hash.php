<?php
if (!isset($_GET['p'])) {
    echo '<form>Password: <input name="p" type="text"> <button>Hash</button></form>';
    exit;
}

$password = $_GET['p'];
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

echo "<pre>";
echo "Password: $password\n";
echo "Hash:     $hash\n";
echo "\nSQL:\nUPDATE `users` SET `password` = '$hash' WHERE `username` = 'superadmin';";
echo "</pre>";
echo "<p style='color:red'><strong>DELETE this file after use!</strong></p>";