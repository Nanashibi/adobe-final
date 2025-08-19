import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      <nav className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-semibold tracking-tight text-xl">
          forty2
        </Link>
      </nav>
    </header>
  );
};

export default Header;
