export type NoteCategoryId = "work" | "study" | "life" | "society";

export interface NoteCategory {
  id: NoteCategoryId;
  name: string;
  eyebrow: string;
  desc: string;
  intro: string;
}

// 分类元信息（不含文章正文）。文章本体是独立的 Markdown 文件：
// src/content/notes/<分类>/<slug>.md
// 新增文章：在对应分类目录下新建 .md，写好 frontmatter 即可，页面/链接自动生成。
export const noteCategories: NoteCategory[] = [
  {
    id: "work",
    name: "工作",
    eyebrow: "Work Journal",
    desc: "项目复盘、技术笔记、踩坑记录——从财务、电商到 AI 开发，这一路做过的事。",
    intro: "工作不是简历上的几行字，而是每次落地、返工和重新判断之后留下的经验。",
  },
  {
    id: "study",
    name: "学习",
    eyebrow: "Learning Notes",
    desc: "新框架、新工具、AI 领域的新动态，学到什么就记下什么。",
    intro: "这里不追求完整教程，只保存真正学会、真正用过，以及还没想明白的部分。",
  },
  {
    id: "life",
    name: "生活",
    eyebrow: "Life Log",
    desc: "开店、画画、游戏和日常，记录一切与代码无关又有关的日子。",
    intro: "生活不只是项目进度，也有普通的情绪、爱好和一些没有结果的小事。",
  },
  {
    id: "society",
    name: "社会讨论",
    eyebrow: "Social Notes",
    desc: "对热点事件和社会现象的个人看法，不一定对，但尽量独立思考。",
    intro: "不急着站队，先把问题拆开。这里保留的是当时的判断，也允许以后推翻。",
  },
];

export const getCategory = (id: string) =>
  noteCategories.find((category) => category.id === id);
