CREATE DATABASE IF NOT EXISTS trinitas_db;
USE trinitas_db;

CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'REPARTIDOR') NOT NULL DEFAULT 'REPARTIDOR'
);

CREATE TABLE IF NOT EXISTS Streets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Demarcations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    street_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (street_id) REFERENCES Streets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_street (user_id, street_id)
);

CREATE TABLE IF NOT EXISTS Notifications (
    id VARCHAR(5) PRIMARY KEY, -- id like '00001'
    recipient_name VARCHAR(255) NOT NULL,
    full_address VARCHAR(255) NOT NULL,
    street_id INT,
    assigned_user_id INT,
    status ENUM('PENDING', 'ATTEMPT_1', 'DELIVERED', 'RETURNED', 'FAILED') DEFAULT 'PENDING',
    FOREIGN KEY (street_id) REFERENCES Streets(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_user_id) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Delivery_Attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(5) NOT NULL,
    attempt_number INT NOT NULL CHECK (attempt_number IN (1, 2)),
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status_result ENUM('DELIVERED', 'ABSENT', 'REFUSED', 'UNKNOWN') NOT NULL,
    receiver_name VARCHAR(255) NULL,
    receiver_dni VARCHAR(20) NULL,
    signature_base64 LONGTEXT NULL,
    delivered_by INT NOT NULL,
    FOREIGN KEY (notification_id) REFERENCES Notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (delivered_by) REFERENCES Users(id) ON DELETE CASCADE
);

-- Insert default admin user if not exists (password: Trinitas2024!)
-- Hash generated for bcryptjs: $2b$10$J0ptb.r/JTZtF4nS7FTK2uk0TFZLu.fBNzWWRHJlpubgYxGhPb4XO
INSERT INTO Users (name, username, password_hash, role)
SELECT 'Admin', 'admin', '$2b$10$J0ptb.r/JTZtF4nS7FTK2uk0TFZLu.fBNzWWRHJlpubgYxGhPb4XO', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE username = 'admin');
