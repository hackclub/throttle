import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "@/components/ui/cx";

// Hand-rolled prose style. Raw HTML is dropped (skipHtml) and react-markdown's
// default urlTransform strips javascript: and friends.
const prose = [
  "text-[15px] leading-relaxed text-hc-dark break-words",
  "[&>*+*]:mt-3",
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:leading-snug",
  "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:leading-snug",
  "[&_h3]:font-bold [&_h4]:font-bold",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1 [&_li>ul]:mt-1 [&_li>ol]:mt-1",
  "[&_a]:text-hc-blue [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-hc-blue/80",
  "[&_strong]:font-bold",
  "[&_code]:rounded [&_code]:border [&_code]:border-line [&_code]:bg-mist [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13px]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-mist [&_pre]:p-3",
  "[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-hc-dark/70",
  "[&_hr]:border-line",
  "[&_img]:max-w-full [&_img]:rounded-lg",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-line [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium",
  "[&_td]:border-b [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3",
  "[&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:align-middle",
].join(" ");

// Same-site paths ("/docs/tiers", "#safety") stay in the tab; anything else opens a new one.
function isInternal(href: string | undefined): boolean {
  if (!href) return false;
  return href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//"));
}

const components: Components = {
  a: ({ href, children }) =>
    isInternal(href) ? (
      <a href={href}>{children}</a>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
};

/** Renders user markdown (GFM). Works in server and client components. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx(prose, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
