import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OriginalityChecker from "@/components/OriginalityChecker";

const Checker = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <section className="pt-28 sm:pt-28 pb-16 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <OriginalityChecker />
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Checker;