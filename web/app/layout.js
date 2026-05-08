import "./globals.css";

export const metadata = {
  title: "家庭孕育知识库",
  description: "本地知识库审核台与 reviewed 卡片问答"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
