import {
  ArrowLeftRight,
  BellRing,
  BookOpen,
  CalendarCheck,
  ChartColumnBig,
  ChevronDown,
  CircleHelp,
  Leaf,
  type LucideIcon,
  PenLine,
  Plus,
  Repeat,
  Settings,
  ShieldCheck,
  Smartphone,
  Tags,
  Target,
  TriangleAlert,
  WalletMinimal,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { CATEGORY_META } from '@/lib/categories'
import { BUDGET_CATEGORIES } from '@/lib/finance'
import { PASSWORD_MIN_LENGTH } from '@/lib/password-policy'

export const metadata: Metadata = { title: 'Hướng dẫn' }

const QUICK_START = [
  { icon: WalletMinimal, title: 'Đặt ngân sách tháng', text: 'Vào Ngân sách, nhập số dự kiến cho từng nhóm. Chỉ mất 2 phút mỗi tháng.' },
  { icon: Plus, title: 'Ghi ngay khi chi', text: 'Bấm nút Ghi ở giữa thanh dưới, nhập số tiền, chọn khoản mục, Lưu.' },
  { icon: ChartColumnBig, title: 'Xem lại cuối tháng', text: 'Phân tích cho biết tiền đi đâu, tháng nào tiết kiệm được nhiều nhất.' },
]

const TOC: { id: string; label: string }[] = [
  { id: 'hom-nay', label: 'Thẻ Hôm nay' },
  { id: 'ghi', label: 'Ghi giao dịch' },
  { id: 'dinh-ky', label: 'Khoản định kỳ' },
  { id: 'ngan-sach', label: 'Ngân sách' },
  { id: 'canh-bao', label: 'Cảnh báo' },
  { id: 'muc-tieu', label: 'Mục tiêu' },
  { id: 'thu-chi', label: 'Sổ thu chi' },
  { id: 'phan-tich', label: 'Phân tích' },
  { id: 'phan-loai', label: 'Phân loại' },
  { id: 'cai-dat', label: 'Cài đặt' },
  { id: 'cai-app', label: 'Cài app' },
  { id: 'bao-mat', label: 'Bảo mật' },
  { id: 'hoi-dap', label: 'Hỏi đáp' },
]

/**
 * "Hướng dẫn": every feature of the app on one page, for people opening it for the first time.
 * Static (no data), so it renders instantly. Keep it in step with the app when features change.
 */
export default function GuidePage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-line p-5 shadow-[var(--shadow-2)] [background:var(--hero-bg)] sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
          <BookOpen className="icon-swing size-3.5" aria-hidden />
          Hướng dẫn sử dụng
        </span>
        <h1 className="mt-3 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">Mọi điều CT9 Finance làm được</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">
          CT9 Finance giúp bạn ghi thu chi mỗi ngày trong vài giây, đặt ngân sách theo tháng và xem tiền của mình đi đâu. Ứng dụng chỉ có
          giá trị khi dữ liệu đều đặn, nên mọi thứ được thiết kế để việc ghi chép nhanh và nhẹ nhàng nhất.
        </p>

        <h2 className="mt-6 text-sm font-semibold">Bắt đầu trong 3 bước</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {QUICK_START.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rise-in flex gap-3 rounded-2xl border border-line bg-surface/80 p-3.5" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-on-brand">
                <Icon className="size-5" aria-hidden />
                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-surface">{i + 1}</span>
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-ink-2">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <nav aria-label="Mục lục hướng dẫn" className="-mx-4 sm:mx-0">
        <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:px-0">
          {TOC.map((item) => (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink pointer-coarse:h-10"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="hom-nay" icon={CalendarCheck} title="Thẻ Hôm nay" link={{ href: '/', label: 'Mở Tổng quan' }}>
        <p>Thẻ đầu tiên ở trang Tổng quan, luôn nói về <strong>hôm nay</strong>, dù bên dưới bạn đang xem tháng nào.</p>
        <Points
          items={[
            <>
              <strong>Hôm nay còn được chi</strong> = (ngân sách chi tiêu của tháng − số đã chi các ngày trước) ÷ số ngày còn lại, tính cả
              hôm nay. Mỗi khoản chi bạn ghi làm con số giảm ngay. Chi quá hôm nay thì mức gợi ý những ngày sau tự điều chỉnh.
            </>,
            <>
              <strong>Chuỗi ngày ghi chép:</strong> mỗi ngày có ít nhất một giao dịch là một ngày trong chuỗi. Hôm nay chưa ghi thì chưa tính
              là bỏ lỡ.
            </>,
            <>
              <strong>Dải 7 ngày:</strong> chạm vào một ngày để xem các khoản của ngày đó, ghi bù, sửa, hoặc đánh dấu không chi tiêu.
            </>,
            <>
              <strong>Hôm nay không chi tiêu</strong> <Leaf className="inline size-3.5 text-positive" aria-hidden />: ngày thật sự không tiêu
              gì thì bấm nút này để giữ chuỗi. Đánh dấu được trong 2 tháng gần đây, cho ngày chưa có khoản chi.
            </>,
            <>Quên ghi hôm qua? Thẻ nhắc nhẹ và có nút <strong>Ghi bù hôm qua</strong>. Bấm “Để sau” để ẩn trong ngày.</>,
          ]}
        />
      </Section>

      <Section id="ghi" icon={PenLine} title="Ghi giao dịch trong vài giây">
        <Steps
          items={[
            <>
              Bấm nút <strong>Ghi</strong> màu vàng ở giữa thanh dưới (trên máy tính: <strong>Thêm giao dịch</strong> ở thanh bên).
            </>,
            <>
              Nhập <strong>số tiền</strong>. Nút <strong>000</strong> thêm ba số 0, gõ “50” rồi bấm 000 là 50.000 ₫.
            </>,
            <>
              Chọn <strong>khoản mục</strong> trong các gợi ý (khoản hay dùng nằm đầu) hoặc gõ tên mới. Gợi ý lọc theo chữ bạn gõ, không cần
              gõ dấu.
            </>,
            <>
              <strong>Phân loại</strong> tự điền theo lần ghi trước của khoản mục đó. Chọn lại nếu cần.
            </>,
            <>
              Chọn ngày: <strong>Hôm nay</strong>, <strong>Hôm qua</strong> hoặc <strong>Ngày khác</strong> (mở lịch). Thêm ghi chú nếu muốn,
              rồi <strong>Lưu</strong>.
            </>,
          ]}
        />
        <Points
          items={[
            <>
              <strong>Lưu, thêm tiếp</strong>: ghi liền nhiều khoản (ví dụ sau khi đi chợ) mà không phải mở lại form.
            </>,
            <>
              Ngay sau khi lưu có nút <strong>Hoàn tác</strong> trong vài giây nếu bạn ghi nhầm.
            </>,
            <>
              <strong>Ghi nhanh</strong> ở trang Tổng quan: các khoản bạn chi nhiều nhất 30 ngày qua. Chạm một khoản là form mở sẵn khoản mục,
              phân loại và số tiền lần trước. Không có gì được lưu nếu bạn chưa bấm Lưu.
            </>,
            <>
              Muốn sửa hoặc xoá: chạm vào giao dịch ở bất kỳ danh sách nào.
            </>,
            <>
              Trên Android, <strong>chạm giữ biểu tượng app</strong> để vào thẳng “Ghi khoản chi” hoặc “Ghi khoản thu”.
            </>,
          ]}
        />
      </Section>

      <Section id="dinh-ky" icon={Repeat} title="Khoản định kỳ: tiền nhà, điện nước, wifi, lương" link={{ href: '/settings#recurring', label: 'Thiết lập khoản định kỳ' }}>
        <p>Những khoản tháng nào cũng có chỉ cần đặt một lần. Đến ngày, app gợi ý sẵn để bạn chỉ cần xác nhận.</p>
        <Steps
          items={[
            <>
              Tạo khoản định kỳ trong <strong>Cài đặt → Giao dịch định kỳ</strong> (có mẫu chọn nhanh), hoặc tick{' '}
              <strong>Lặp lại hằng tháng</strong> khi ghi một giao dịch mới.
            </>,
            <>
              Mỗi tháng, thẻ <strong>Khoản định kỳ</strong> ở trang Tổng quan liệt kê các khoản đến hạn. Bấm <strong>Xác nhận</strong> để
              ghi, hoặc <strong>Số tiền khác</strong> nếu tháng này khác (tiền điện chẳng hạn).
            </>,
            <>
              Tháng nào không có thì bấm <strong>Bỏ qua</strong>. Nhiều khoản đến hạn cùng lúc có nút <strong>Xác nhận tất cả</strong>.
            </>,
          ]}
        />
        <Points
          items={[
            'App không bao giờ tự ghi khi bạn chưa xác nhận.',
            'Xác nhận trễ vẫn ghi đúng ngày đến hạn; xác nhận sớm (như lương về sớm) thì ghi hôm nay.',
            'Ngày 29, 30, 31 rơi vào ngày cuối của tháng ngắn hơn. Tắt công tắc để tạm dừng một khoản mà không xoá.',
          ]}
        />
      </Section>

      <Section id="ngan-sach" icon={WalletMinimal} title="Lập ngân sách" link={{ href: '/budget', label: 'Mở Ngân sách' }}>
        <p>
          Ngân sách là số <strong>dự kiến</strong> cho từng nhóm trong tháng. Số <strong>thực tế</strong> app tự tính từ các giao dịch bạn
          ghi, nên không bao giờ lệch.
        </p>
        <Steps
          items={[
            'Chọn tháng, nhập dự kiến cho thu nhập, ba nhóm chi tiêu và tiết kiệm/đầu tư.',
            <>
              Tick <strong>áp dụng cho các tháng sau</strong> để dùng cùng số cho các tháng còn lại trong năm, rồi Lưu.
            </>,
            <>
              Đổi chế độ xem <strong>Dự kiến / Thực tế / Chênh lệch</strong> để so sánh. Biểu đồ cho thấy từng tháng vượt hay dưới kế hoạch.
            </>,
          ]}
        />
        <p className="text-muted">Ngân sách chi tiêu cũng là con số dùng để tính “Hôm nay còn được chi” ở thẻ Hôm nay.</p>
      </Section>

      <Section id="canh-bao" icon={TriangleAlert} title="Cảnh báo ngân sách">
        <Points
          items={[
            <>
              Khi một nhóm chi (thiết yếu, không thiết yếu, phát sinh) dùng tới <strong>80%</strong> ngân sách tháng, trang Tổng quan và Ngân
              sách hiện cảnh báo <strong>Sắp hết</strong> màu vàng, kèm số còn lại và mức gợi ý mỗi ngày.
            </>,
            <>
              <strong>Vượt</strong> kế hoạch thì cảnh báo chuyển đỏ và cho biết vượt bao nhiêu.
            </>,
            'Ngay lúc bạn lưu khoản chi làm một nhóm chạm ngưỡng, app hiện thông báo. Chỉ báo một lần khi chạm ngưỡng, không nhắc lại mỗi khoản sau.',
            'Bấm ✕ để ẩn. Cảnh báo hiện lại khi có nhóm mới chạm ngưỡng.',
            'Tiết kiệm/đầu tư là mục tiêu, không phải hạn mức, nên không có cảnh báo.',
          ]}
        />
      </Section>

      <Section id="muc-tieu" icon={Target} title="Mục tiêu: xây quỹ từ tiền tiết kiệm" link={{ href: '/goals', label: 'Mở Mục tiêu' }}>
        <p>
          Mỗi khoản bạn ghi vào nhóm <strong>Tiết kiệm/Đầu tư</strong> thành <strong>tiền tiết kiệm chưa phân bổ</strong>. Ở trang Mục tiêu, bạn chia
          số tiền đó vào các quỹ, ví dụ đã tiết kiệm 35 triệu thì bỏ 20 triệu vào Quỹ khẩn cấp và 15 triệu vào quỹ Đi du lịch.
        </p>
        <Steps
          items={[
            <>
              <strong>Quỹ khẩn cấp</strong> có sẵn: nhập chi phí cố định 1 tháng và số tháng dự phòng (nên 3–6 tháng). App gợi ý số chi tiêu thiết yếu
              trung bình 3 tháng qua.
            </>,
            <>
              <strong>Tạo quỹ mới</strong> cho từng mục tiêu: tên, số tiền, số tháng, nơi cất (ngân hàng, ứng dụng tài chính, MMF) và lợi nhuận kỳ vọng
              (tối đa 12%/năm). App tính ngay mỗi tháng cần tiết kiệm bao nhiêu.
            </>,
            <>
              Bấm <strong>Phân bổ vào quỹ</strong> để chia tiền vào một hoặc nhiều quỹ cùng lúc. <strong>Rút</strong> để đưa tiền về lại phần chưa phân bổ.
            </>,
          ]}
        />
        <Points
          items={[
            'Mỗi quỹ cho biết số dư (gồm lãi tính theo ngày), phần trăm hoàn thành, đúng hay chậm tiến độ và số cần gửi mỗi tháng từ giờ để kịp hạn.',
            '4 cột mốc đánh giá ở 25%, 50%, 75% và 100% thời gian. Chi tiết quỹ có lịch sử nạp/rút và ghi chú.',
            <>
              Đặt ngân sách <strong>Tiết kiệm/Đầu tư</strong> của tháng để app cho biết kế hoạch có khả thi: tổng các quỹ cần nhiều hơn ngân sách là chưa
              khả thi.
            </>,
            'Quỹ đã dùng xong thì lưu trữ. Bấm biểu tượng thùng rác để xoá một quỹ (kể cả Quỹ khẩn cấp): tiền của quỹ quay về phần chưa phân bổ, các giao dịch tiết kiệm đã ghi vẫn giữ nguyên.',
          ]}
        />
      </Section>

      <Section id="thu-chi" icon={ArrowLeftRight} title="Sổ thu chi" link={{ href: '/transactions', label: 'Mở Thu chi' }}>
        <Points
          items={[
            'Danh sách mọi giao dịch theo tháng, mới nhất trước.',
            <>
              <strong>Lọc</strong> theo tháng, loại (thu nhập / chi tiêu) và phân loại. <strong>Tìm kiếm</strong> theo khoản mục hoặc ghi chú,
              không cần gõ dấu.
            </>,
            <>
              <strong>Xuất CSV</strong>: tải danh sách đang lọc về máy, mở được bằng Excel.
            </>,
          ]}
        />
      </Section>

      <Section id="phan-tich" icon={ChartColumnBig} title="Phân tích" link={{ href: '/analytics', label: 'Mở Phân tích' }}>
        <Points
          items={[
            <>
              <strong>Tổng quan cả năm</strong>: tổng thu nhập, chi tiêu, tiết kiệm, thặng dư, trung bình mỗi tháng, tích lũy và tỷ lệ tích lũy
              trên thu nhập.
            </>,
            'Biểu đồ thu nhập, chi tiêu, cơ cấu chi tiêu, tiết kiệm và thặng dư theo 12 tháng.',
            <>
              Bảng 12 tháng xem theo <strong>Số tiền</strong> hoặc <strong>Tỷ trọng</strong>.
            </>,
            <>
              <strong>Top khoản chi cả năm</strong> và <strong>Chi tiết theo khoản mục</strong>: chọn một khoản để xem nó thay đổi qua từng
              tháng.
            </>,
          ]}
        />
      </Section>

      <Section id="phan-loai" icon={Tags} title="7 nhóm phân loại">
        <p>Mỗi giao dịch thuộc một nhóm. Nhóm quyết định giao dịch được tính vào đâu trong ngân sách và phân tích.</p>
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Nhóm
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Dùng cho
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {BUDGET_CATEGORIES.map((c) => (
                <tr key={c}>
                  <th scope="row" className="px-3 py-2.5 align-top font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="size-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
                      {CATEGORY_META[c].label}
                    </span>
                  </th>
                  <td className="px-3 py-2.5 text-ink-2">{CATEGORY_META[c].hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl bg-brand-soft p-3.5 text-sm text-ink">
          <p>
            <strong>Tổng chi tiêu</strong> = Thiết yếu + Không thiết yếu + Phát sinh (không gồm tiết kiệm/đầu tư).
          </p>
          <p className="mt-1">
            <strong>Thặng dư</strong> = Thu nhập − Chi tiêu − Tiết kiệm/Đầu tư.
          </p>
        </div>
      </Section>

      <Section id="cai-dat" icon={Settings} title="Cài đặt" link={{ href: '/settings', label: 'Mở Cài đặt' }}>
        <Points
          items={[
            <>
              <strong>Giao diện</strong>: Sáng (mặc định), Tối hoặc Theo thiết bị. Lưu riêng trên từng máy.
            </>,
            <>
              <strong>Nhắc ghi chép</strong> <BellRing className="inline size-3.5 text-brand-ink" aria-hidden />: chọn giờ, mỗi ngày điện
              thoại hiện một thông báo nhắc bạn ghi thu chi. Trên iPhone cần cài app ra màn hình chính trước (xem mục Cài app).
            </>,
            <>
              <strong>Giao dịch định kỳ</strong>: thêm, sửa, tạm dừng hoặc xoá các khoản lặp lại hằng tháng.
            </>,
            <>
              <strong>Danh mục khoản mục</strong>: các gợi ý khi ghi. Đặt phân loại mặc định, đổi tên (có thể đổi luôn tên trong các giao dịch
              cũ) hoặc xoá. Xoá khỏi danh mục không xoá giao dịch đã ghi.
            </>,
            <>
              <strong>Đổi mật khẩu</strong> và <strong>Đăng xuất</strong>.
            </>,
          ]}
        />
      </Section>

      <Section id="cai-app" icon={Smartphone} title="Cài app lên điện thoại">
        <p>CT9 Finance chạy trên trình duyệt nhưng cài được như một app: có biểu tượng riêng, mở toàn màn hình và nhận được thông báo nhắc.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-3.5">
            <p className="text-sm font-semibold">iPhone (Safari)</p>
            <Steps compact items={['Mở app bằng Safari.', <>Bấm nút <strong>Chia sẻ</strong> (ô vuông có mũi tên lên).</>, <>Chọn <strong>Thêm vào Màn hình chính</strong>.</>]} />
          </div>
          <div className="rounded-2xl border border-line p-3.5">
            <p className="text-sm font-semibold">Android (Chrome)</p>
            <Steps compact items={['Mở app bằng Chrome.', <>Bấm menu <strong>⋮</strong> ở góc trên.</>, <>Chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>.</>]} />
          </div>
        </div>
      </Section>

      <Section id="bao-mat" icon={ShieldCheck} title="Tài khoản và bảo mật">
        <Points
          items={[
            'Mỗi tài khoản chỉ thấy dữ liệu của chính mình. Quy tắc này nằm ngay trong cơ sở dữ liệu, không chỉ ở giao diện.',
            'Ứng dụng không có đăng ký. Tài khoản do quản trị viên tạo.',
            <>
              Mật khẩu mới phải đủ mạnh: ít nhất {PASSWORD_MIN_LENGTH} ký tự, có chữ thường, chữ hoa, chữ số, ký tự đặc biệt và không có chuỗi dễ
              đoán. Danh sách yêu cầu hiện ngay khi bạn gõ.
            </>,
            'Đổi mật khẩu thì các thiết bị khác bị đăng xuất ngay. Mất điện thoại? Đổi mật khẩu từ máy khác.',
            <>
              <strong>Quên mật khẩu</strong>: bấm “Quên mật khẩu?” ở trang đăng nhập, app gửi một liên kết qua email. Liên kết chỉ dùng được một
              lần và hết hạn sau ít phút.
            </>,
          ]}
        />
      </Section>

      <Section id="hoi-dap" icon={CircleHelp} title="Câu hỏi thường gặp">
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          <Faq q="Quên ghi mấy hôm trước thì sao?">
            Chạm vào ngày đó trong dải 7 ngày ở thẻ Hôm nay để ghi bù, hoặc chọn <strong>Ngày khác</strong> khi ghi. Chuỗi ngày tự nối lại. Nghỉ
            lâu thì cứ bắt đầu lại từ hôm nay, không cần ghi bù hết.
          </Faq>
          <Faq q="Vì sao “Hôm nay còn được chi” thay đổi mỗi ngày?">
            Con số chia đều phần ngân sách còn lại cho số ngày còn lại trong tháng. Hôm qua tiêu ít thì hôm nay được chi nhiều hơn, và ngược
            lại.
          </Faq>
          <Faq q="Tiết kiệm có bị tính là chi tiêu không?">
            Không. Tiền gửi tiết kiệm hay đầu tư ghi vào nhóm <strong>Tiết kiệm/Đầu tư</strong>, tính riêng và không làm tăng tổng chi tiêu.
          </Faq>
          <Faq q="Ghi nhầm thì sửa thế nào?">
            Bấm <strong>Hoàn tác</strong> ngay sau khi lưu, hoặc chạm vào giao dịch ở bất kỳ danh sách nào để sửa hay xoá.
          </Faq>
          <Faq q="Khoản định kỳ có tự trừ tiền không?">
            Không. App chỉ gợi ý; giao dịch chỉ được ghi khi bạn bấm Xác nhận. App cũng không kết nối với ngân hàng hay ví điện tử.
          </Faq>
          <Faq q="Dùng trên nhiều máy được không?">
            Được. Đăng nhập cùng tài khoản trên điện thoại và máy tính, dữ liệu luôn giống nhau. Giao diện sáng/tối thì chọn riêng trên từng máy.
          </Faq>
          <Faq q="Mất mạng có ghi được không?">
            Hiện tại cần có mạng để lưu. Nếu mạng chập chờn, hãy bấm Lưu lại khi có sóng.
          </Faq>
        </div>
      </Section>

      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold">Sẵn sàng rồi?</p>
          <p className="text-sm text-muted">Khoản đầu tiên chỉ mất vài giây.</p>
        </div>
        <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand-edge bg-brand px-5 text-sm font-medium text-on-brand hover:bg-brand-hover">
          <Plus className="size-4" aria-hidden />
          Về trang Tổng quan
        </Link>
      </Card>
    </div>
  )
}

function Section({
  id,
  icon: Icon,
  title,
  link,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  link?: { href: string; label: string }
  children: ReactNode
}) {
  return (
    <Card id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 p-4 sm:p-6 lg:scroll-mt-8">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon className="size-5" aria-hidden />
        </span>
        <h2 id={`${id}-title`} className="pt-2 text-lg leading-snug font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
      {link ? (
        <Link href={link.href} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand-ink hover:underline">
          {link.label} →
        </Link>
      ) : null}
    </Card>
  )
}

function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand-ink/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Steps({ items, compact = false }: { items: ReactNode[]; compact?: boolean }) {
  return (
    <ol className={compact ? 'mt-2 space-y-1.5' : 'space-y-2.5'}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand"
          >
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}
