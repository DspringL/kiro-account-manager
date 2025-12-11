# Kiro Account Manager

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Logo" width="80">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue" alt="Platform">
  <img src="https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?label=Version&color=green" alt="Version">
  <img src="https://img.shields.io/github/downloads/hj01857655/kiro-account-manager/total?color=brightgreen" alt="Downloads">
  <img src="https://img.shields.io/github/license/hj01857655/kiro-account-manager?color=orange" alt="License">
  <img src="https://img.shields.io/badge/QQ群-1020204332-12B7F5?logo=tencentqq" alt="QQ群">
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README_zh-CN.md">简体中文</a> | <a href="README_ru-RU.md">Русский</a>
</p>

<p align="center">
  <b>Умное управление токенами Kiro с переключением в один клик и мониторингом квот</b>
</p>

---

## ✨ Возможности

### 🔐 Вход в аккаунт
- **Desktop OAuth** - Авторизация на рабочем столе для Google/GitHub/BuilderId
- **Web Portal OAuth** - Веб-авторизация в окне WebView
- Два метода дополняют друг друга для надёжного входа

### � Отобраыжение аккаунтов
- Карточный интерфейс, всё наглядно
- Прогресс-бар квот (основные/пробные/бонусные)
- Значок типа подписки (Free/PRO/PRO+)
- Обратный отсчёт истечения токена
- Подсветка статуса (активен/истёк/заблокирован/текущий)

### 🔄 Переключение в один клик
- Бесшовное переключение аккаунта Kiro IDE
- Автоматический сброс Machine ID
- Отображение прогресса в реальном времени

### 📦 Пакетные операции
- Массовое обновление / удаление
- Импорт/экспорт JSON
  - Social: refreshToken + provider
  - IdC: refreshToken + clientId + clientSecret
- Массовый импорт SSO Token
- Поиск по ключевым словам

### 🔌 Конфигурация Kiro
- **MCP серверы** - CRUD, включение/отключение
- **Powers** - Просмотр, установка, удаление
- **Steering правила** - Просмотр, редактирование

### ⚙️ Системные настройки
- Четыре темы (светлая/тёмная/фиолетовая/зелёная)
- Выбор и блокировка AI модели
- Автообновление токенов (настраиваемый интервал)
- Автосброс Machine ID при переключении

### 🌐 Браузер и прокси
- Пользовательский браузер / автоопределение
- Запуск в режиме инкогнито
- Настройка HTTP прокси / автоопределение

### 🔑 Управление Machine Code
- Просмотр / резервное копирование / восстановление / сброс
- Поддержка Windows / macOS

### 🖥️ Интеграция с IDE
- Определение статуса работы Kiro IDE
- Запуск / остановка в один клик
- Автосинхронизация прокси и настроек модели

## 📸 Скриншоты

| Главная | Управление аккаунтами |
|:---:|:---:|
| ![Главная](screenshots/首页.png) | ![Аккаунты](screenshots/账号管理.png) |

| Вход | Настройки |
|:---:|:---:|
| ![Вход](screenshots/登录页.png) | ![Настройки](screenshots/设置.png) |

## 📥 Скачать

[![Release](https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?style=flat-square)](https://github.com/hj01857655/kiro-account-manager/releases/latest)

👉 **[Скачать последнюю версию](https://github.com/hj01857655/kiro-account-manager/releases/latest)**

| Платформа | Тип файла | Описание |
|-----------|-----------|----------|
| Windows | `.msi` | Рекомендуется, двойной клик для установки |
| Windows | `.exe` | NSIS установщик |
| macOS | `.dmg` | Перетащите в Applications |

## 💻 Системные требования

- **Windows**: Windows 10/11 (64-bit), требуется WebView2 (встроен в Win11)
- **macOS**: macOS 10.15+ (универсальный для Intel/Apple Silicon)

## 🛠️ Технологии

- **Фронтенд**: React 18 + Vite 5 + TailwindCSS 3 + Lingui (i18n)
- **Бэкенд**: Tauri 2.x + Rust + Tokio
- **Иконки**: Lucide React
- **Хранение**: Локальные JSON файлы

## ❓ Часто задаваемые вопросы

**Q: Не удается войти?**
A: Проверьте подключение к интернету, попробуйте использовать прокси или другой способ входа.

**Q: Токен истек?**
A: Нажмите кнопку обновления или включите автоматическое обновление.

**Q: Как сделать резервную копию аккаунтов?**
A: Используйте функцию экспорта для сохранения данных в JSON файл.

**Q: Не удается сбросить системный машинный код?**
A: Windows требует права администратора для изменения реестра. Запустите приложение от имени администратора.

## 💬 Обратная связь

- 🐛 [Создать Issue](https://github.com/hj01857655/kiro-account-manager/issues)
- 💬 QQ группа: [1020204332](https://qm.qq.com/q/Vh7mUrNpa8)

## ⚠️ Отказ от ответственности

Данное программное обеспечение предназначено только для обучения и общения. Не используйте в коммерческих целях. Пользователи несут ответственность за любые последствия.

## 📄 Лицензия

[GPL-3.0](LICENSE) - Модификации должны быть открыты.

---

<p align="center">Made with ❤️ by hj01857655</p>
<p align="center">Если проект вам помог, поставьте ⭐!</p>
