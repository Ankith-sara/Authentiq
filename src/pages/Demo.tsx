import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OriginalityChecker from "@/components/OriginalityChecker";
import { History } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Demo = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <section className="pt-28 sm:pt-28 pb-16 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-12 animate-fade-in">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Try Authentiq
            </h1>
          </div>
          <OriginalityChecker />
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Demo;