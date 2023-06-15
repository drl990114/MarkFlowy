
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"

export interface LayoutProps {
  menus: {
    main: ILink[]
    footer: DefaultLink[]
  }
}

export function Layout({ menus, children }: PropsWithChildren<LayoutProps>) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar links={menus.main} />
      <main className="flex-1">{children}</main>
      <Footer links={menus.footer} />
    </div>
  )
}
