"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Clock, CheckCircle, XCircle, RotateCcw, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"

interface EmailStatus {
  id: string
  recipientName: string
  recipientTitle: string
  avatar: string
  company: string
  status: "sent" | "replied" | "no-response"
  sentDate: string
  followUpsCount: number
  lastActivity: string
}

const mockEmailStatuses: EmailStatus[] = [
  {
    id: "1",
    recipientName: "Sarah Chen",
    recipientTitle: "Senior Software Engineer",
    avatar: "/placeholder.svg?height=40&width=40",
    company: "Google",
    status: "replied",
    sentDate: "2024-01-15",
    followUpsCount: 0,
    lastActivity: "2024-01-16",
  },
  {
    id: "2",
    recipientName: "Michael Rodriguez",
    recipientTitle: "Product Manager",
    avatar: "/placeholder.svg?height=40&width=40",
    company: "Google",
    status: "sent",
    sentDate: "2024-01-14",
    followUpsCount: 1,
    lastActivity: "2024-01-15",
  },
  {
    id: "3",
    recipientName: "Emily Johnson",
    recipientTitle: "Engineering Manager",
    avatar: "/placeholder.svg?height=40&width=40",
    company: "Google",
    status: "sent",
    sentDate: "2024-01-13",
    followUpsCount: 2,
    lastActivity: "2024-01-17",
  },
  {
    id: "4",
    recipientName: "David Kim",
    recipientTitle: "VP of Engineering",
    avatar: "/placeholder.svg?height=40&width=40",
    company: "Google",
    status: "no-response",
    sentDate: "2024-01-10",
    followUpsCount: 3,
    lastActivity: "2024-01-16",
  },
]

export default function DashboardPage() {
  const [emailStatuses] = useState<EmailStatus[]>(mockEmailStatuses)
  const router = useRouter()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "replied":
        return <CheckCircle className="h-4 w-4 text-sky-600" />
      case "sent":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "no-response":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string, emailId?: string) => {
    const variants = {
      replied: "default",
      sent: "outline",
      "no-response": "destructive",
    } as const

    const labels = {
      replied: "Replied",
      sent: "Sent",
      "no-response": "No Response",
    }

    const badge = (
      <Badge
        variant={variants[status as keyof typeof variants]}
        className={status === "replied" ? "bg-sky-600 text-white hover:bg-sky-700 cursor-pointer" : ""}
      >
        {labels[status as keyof typeof labels]}
      </Badge>
    )

    if (status === "replied") {
      return (
        <a
          href={`mailto:?subject=Re: Your email response&body=Click to view the email response from ${emailId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {badge}
        </a>
      )
    }

    return badge
  }

  const stats = {
    totalSent: emailStatuses.length,
    replied: emailStatuses.filter((e) => e.status === "replied").length,
    noResponse: emailStatuses.filter((e) => e.status === "no-response").length,
    responseRate: Math.round((emailStatuses.filter((e) => e.status === "replied").length / emailStatuses.length) * 100),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/connections")}
            className="mb-4 text-gray-700 hover:bg-white/50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Connections
          </Button>

          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Outreach Dashboard</h1>
              <p className="text-lg text-gray-600">Track your cold email campaigns and responses</p>
            </div>
            <Button onClick={() => router.push("/search")} className="bg-sky-600 hover:bg-sky-700 text-white">
              <TrendingUp className="mr-2 h-4 w-4" />
              New Internship Campaign
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Emails Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSent}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Replies Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-600">{stats.replied}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Response Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-600">{stats.responseRate}%</div>
              <Progress value={stats.responseRate} className="mt-2 bg-sky-200 [&>div]:bg-sky-700" />
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">No Response</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.noResponse}</div>
            </CardContent>
          </Card>
        </div>

        {/* Email Status Tracking */}
        <Card className="bg-white border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Email Status Tracking</CardTitle>
            <CardDescription>Monitor the status of your outreach emails and follow-ups</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-sky-100">
                <TabsTrigger value="all">All ({stats.totalSent})</TabsTrigger>
                <TabsTrigger value="replied">Replied ({stats.replied})</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
                <TabsTrigger value="no-response">No Response ({stats.noResponse})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4 mt-6">
                {emailStatuses.map((email) => (
                  <Card key={email.id} className="bg-white border border-sky-200 shadow-md">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={email.avatar || "/placeholder.svg"} alt={email.recipientName} />
                            <AvatarFallback>
                              {email.recipientName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">{email.recipientName}</h4>
                            <p className="text-sm text-gray-600">
                              {email.recipientTitle} at {email.company}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span>Sent: {new Date(email.sentDate).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>Last activity: {new Date(email.lastActivity).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="flex items-center gap-1 mb-1">
                              <RotateCcw className="h-3 w-3 text-gray-400" />
                              <span className="text-sm font-medium">{email.followUpsCount}</span>
                            </div>
                            <span className="text-xs text-gray-500">Follow-ups</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(email.status)}
                            {getStatusBadge(email.status, email.recipientName)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {["replied", "sent", "no-response"].map((status) => (
                <TabsContent key={status} value={status} className="space-y-4 mt-6">
                  {emailStatuses
                    .filter((email) => email.status === status)
                    .map((email) => (
                      <Card key={email.id} className="bg-white border border-sky-200 shadow-md">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={email.avatar || "/placeholder.svg"} alt={email.recipientName} />
                                <AvatarFallback>
                                  {email.recipientName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-semibold">{email.recipientName}</h4>
                                <p className="text-sm text-gray-600">
                                  {email.recipientTitle} at {email.company}
                                </p>
                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                  <span>Sent: {new Date(email.sentDate).toLocaleDateString()}</span>
                                  <span>•</span>
                                  <span>Last activity: {new Date(email.lastActivity).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <div className="flex items-center gap-1 mb-1">
                                  <RotateCcw className="h-3 w-3 text-gray-400" />
                                  <span className="text-sm font-medium">{email.followUpsCount}</span>
                                </div>
                                <span className="text-xs text-gray-500">Follow-ups</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(email.status)}
                                {getStatusBadge(email.status, email.recipientName)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
