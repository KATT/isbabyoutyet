import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby, Heart, Users, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      {
        title: "Is Baby Out Yet? - Track Your Baby's Journey",
      },
      {
        name: "description",
        content:
          "Track the progress of labor and birth - know when baby arrives! Share updates with family and friends.",
      },
    ],
  }),
});

function HomePage() {
  const sessionData = useSession();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Gradient Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 md:py-32">
        {/* Hero Section */}
        <div className="text-center mb-24">
          <Badge
            variant="outline"
            className="mb-6 border-primary/20 bg-primary/5 text-primary backdrop-blur-sm"
          >
            <Sparkles className="w-3 h-3 mr-1.5" />
            Track your baby's journey
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black text-foreground tracking-tight mb-8 leading-none">
            <span className="bg-linear-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
              Is Baby Out Yet?
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Track the progress of labor and birth. Share real-time updates with family and friends
            in a beautiful, simple way.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {sessionData.data ? (
              <Link to="/dashboard" preload="viewport">
                <Button size="lg" className="text-lg px-8 py-7 h-auto shadow-lg shadow-primary/20">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth/signup" preload="viewport">
                  <Button
                    size="lg"
                    className="text-lg px-8 py-7 h-auto shadow-lg shadow-primary/20"
                  >
                    Get Started
                  </Button>
                </Link>
                <Link to="/auth/login" preload="viewport">
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-7 h-auto border-2 backdrop-blur-sm bg-background/50"
                  >
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-24">
          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                <Baby className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Track Progress</CardTitle>
              <CardDescription>
                Update status as labor progresses - from labor started to baby born. Keep everyone
                in the loop.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Share with Family</CardTitle>
              <CardDescription>
                Create a shareable link for each baby. Family and friends can view updates in
                real-time.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Due Date Tracking</CardTitle>
              <CardDescription>
                Set a due date and see how many days remain. Get notified when baby is overdue.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Get started in minutes and share the journey with loved ones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  step: "1",
                  title: "Sign Up",
                  description: "Create a free account to start tracking your baby's journey.",
                },
                {
                  step: "2",
                  title: "Add Your Baby",
                  description: "Add your baby's name and due date to create a tracking page.",
                },
                {
                  step: "3",
                  title: "Share the Link",
                  description:
                    "Share the unique link with family and friends so they can follow along.",
                },
                {
                  step: "4",
                  title: "Update Status",
                  description:
                    "Update the status as things progress - labor started, gone to hospital, baby born!",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 group">
                  <div className="shrink-0 w-12 h-12 bg-linear-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-6">
            <Heart className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            {sessionData.data
              ? "Continue tracking your baby's journey."
              : "Join families tracking their baby's journey today."}
          </p>
          {sessionData.data ? (
            <Link to="/dashboard" preload="viewport">
              <Button size="lg" className="text-lg px-10 py-7 h-auto shadow-lg shadow-primary/20">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/auth/signup" preload="viewport">
              <Button size="lg" className="text-lg px-10 py-7 h-auto shadow-lg shadow-primary/20">
                Create Your Account
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
