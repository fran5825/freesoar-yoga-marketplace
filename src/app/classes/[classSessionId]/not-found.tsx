import Link from "next/link";

export default function ClassNotFound() {
  return <main className="mx-auto grid min-h-[50vh] max-w-4xl content-center gap-4 px-5 py-10"><h1 className="text-2xl font-semibold text-ink">目前無法查看這堂課程</h1><p className="text-sm leading-6 text-ink-soft">課程可能已停止公開。你可以回到列表，找一堂適合自己的課。</p><Link className="w-fit rounded-full bg-pine px-5 py-3 text-sm text-white" href="/classes">返回課程列表</Link></main>;
}
