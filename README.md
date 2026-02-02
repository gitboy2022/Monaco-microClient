# Monaco-microClient

A lightweight, pre-configured implementation of the [Monaco Editor](https://github.com/microsoft/monaco-editor). This setup is designed to work out-of-the-box by pointing directly to a local `vs` directory.

## 🛠 Installation

The editor relies on the compiled Monaco core library. Follow these steps to set up the dependencies:

1.  **Extract the Library:** Unpack your `monaco-editor.tgz` file (NOT SRC) using [7-Zip](https://www.7-zip.org) or the terminal command:
    ```
    bash
    tar -xvf monaco-editor.tgz
    ```
2.  **Locate the 'vs' Folder:** Open the extracted folder and navigate to `package/min/vs`.
3.  **Deploy to Root:** Copy the `vs` folder and paste it into the project root directory.

## 📂 Project Structure

Ensure all 8 core items are organized as follows for the internal links to resolve correctly:

```text
Monaco-microClient/
├── vs/                         # Extracted core library (loader.js, etc.)
├── Monaco-microClient.html     # Main editor entry point
├── index.js                    # Pre-configured logic (points to vs/)
├── index.css                   # Editor styling
├── README.md                   # Documentation
├── LICENSE                     # License terms
├── NOTICE                      # Credits and legal notices
└── Difference-Checker.html     # Difference checking software
