import { useEffect } from "react";
import BeautifulUploadFlow from "@/components/upload/BeautifulUploadFlow";

const Index = () => {
  useEffect(() => {
    document.title = "Adobe Hackathon - Document Intelligence";
  }, []);

  return <BeautifulUploadFlow />;
};

export default Index;
