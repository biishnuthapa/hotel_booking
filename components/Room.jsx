/**
 * v0 by Vercel.
 * @see https://v0.dev/t/2c2lnYTkV37
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import Link from 'next/link'
import { AvatarImage, AvatarFallback, Avatar } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { CollapsibleTrigger, CollapsibleContent, Collapsible } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'

export default function Component() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <ChevronLeftIcon className="w-4 h-4" />
        <Link className="font-medium underline underline-offset-2" href="#">
          Back to search
        </Link>
      </div>
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Cozy and Charming Mountain Retreat with Hot Tub
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          2 guests · 1 bedroom · 1 bed · 1 bath · Wifi · Kitchen
        </p>
      </div>
      <div className="grid gap-4">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 flex items-center justify-center">
            <Avatar className="w-10 h-10 border">
              <AvatarImage alt="@username" src="/placeholder-user.jpg" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </div>
          <div className="grid gap-0.5">
            <div className="font-semibold">Hosted by Catherine</div>
            <div className="text-gray-500 text-sm dark:text-gray-400">
              Joined in 2010 · Superhost
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 flex items-center justify-center">
            <CalendarCheckIcon className="w-7 h-7" />
          </div>
          <div className="grid gap-0.5">
            <div className="font-semibold">Free cancellation for 48 hours</div>
            <div className="text-gray-500 text-sm dark:text-gray-400">
              Get a full refund if you change your mind.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 flex items-center justify-center">
            <MedalIcon className="w-7 h-7" />
          </div>
          <div className="grid gap-0.5">
            <div className="font-semibold">Catherine is a Superhost</div>
            <div className="text-gray-500 text-sm dark:text-gray-400">
              Superhosts are experienced, highly rated hosts.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 flex items-center justify-center">
            <MapPinIcon className="w-7 h-7" />
          </div>
          <div className="grid gap-0.5">
            <div className="font-semibold">Great location</div>
            <div className="text-gray-500 text-sm dark:text-gray-400">
              100% of recent guests gave the location a 5-star rating.
            </div>
          </div>
        </div>
      </div>
      <Separator className="my-8" />
      <div className="prose">
        <p>
          Welcome to our serene mountain retreat! Nestled amidst the tranquil beauty of the
          mountains, this cozy home is your perfect getaway for relaxation and adventure.
        </p>
        <p>
          Wake up to breathtaking vistas from every window. Enjoy your morning coffee on the
          balcony, taking in the serene landscape. This mountain haven is perfect for families,
          friends, and couples seeking a blend of adventure and relaxation. Book your stay and
          experience the magic of the mountains!
        </p>
        <Collapsible>
          <CollapsibleTrigger className="font-semibold flex items-center gap-1 [&[data-state=open]>svg]:-rotate-90">
            Show more
            <ChevronRightIcon className="w-4 h-4 translate-y-px transition-all" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p>
              Our home comfortably sleeps up to 6 guests in 3 beautifully appointed bedrooms, each
              designed for relaxation and comfort. Cook up a storm in our modern kitchen, complete
              with all the appliances and utensils you need for a home-cooked meal. Stay connected
              with high-speed internet and a dedicated workspace, ideal for those who mix travel
              with work.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Separator className="my-8" />
      <div className="grid gap-8">
        <h3 className="text-xl font-semibold">What this place offers</h3>
        <ul className="grid lg:grid-cols-2 gap-6">
          <li className="flex gap-4">
            <MountainSnowIcon className="w-6 h-6" />
            Mountain view
          </li>
          <li className="flex gap-4">
            <WavesIcon className="w-6 h-6" />
            Beach access
          </li>
          <li className="flex gap-4">
            <ChefHatIcon className="w-6 h-6" />
            Private chef
          </li>
          <li className="flex gap-4">
            <WifiIcon className="w-6 h-6" />
            Wifi
          </li>
          <li className="flex gap-4">
            <CarIcon className="w-6 h-6" />
            Parking
          </li>
          <li className="flex gap-4">
            <CameraIcon className="w-6 h-6" />
            Security cameras
          </li>
          <li className="flex gap-4">
            <AccessibilityIcon className="w-6 h-6" />
            Wheelchair accessible
          </li>
          <li className="flex gap-4">
            <WindIcon className="w-6 h-6" />
            Patio
          </li>
        </ul>
        <Button className="justify-self-start" variant="outline">
          Show all amenities
        </Button>
      </div>
      <Separator className="my-8" />
      <div className="grid gap-8">
        <div className="grid gap-0.5">
          <h3 className="text-xl font-semibold">Find a date</h3>
          <div className="text-gray-500 dark:text-gray-400">
            Pick your travel dates for availability.
          </div>
        </div>
        <div className="sm:border p-0 sm:p-4 rounded-lg justify-self-start">
          <Calendar
            className="p-0 hidden xl:flex [&_td]:w-10 [&_td]:h-10 [&_th]:w-10 [&_[name=day]]:w-10 [&_[name=day]]:h-10 [&>div]:space-x-0 [&>div]:gap-6"
            mode="range"
            numberOfMonths={2}
          />
          <Calendar className="flex xl:hidden p-0" />
        </div>
      </div>
    </div>
  )
}

function AccessibilityIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="16" cy="4" r="1" />
      <path d="m18 19 1-7-6 1" />
      <path d="m5 8 3-3 5.5 3-2.36 3.5" />
      <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
      <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
    </svg>
  )
}

function CalendarCheckIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  )
}

function CameraIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function CarIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}

function ChefHatIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
      <line x1="6" x2="18" y1="17" y2="17" />
    </svg>
  )
}

function ChevronLeftIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function MapPinIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function MedalIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
      <path d="M11 12 5.12 2.2" />
      <path d="m13 12 5.88-9.8" />
      <path d="M8 7h8" />
      <circle cx="12" cy="17" r="5" />
      <path d="M12 18v-2h-.5" />
    </svg>
  )
}

function MountainSnowIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
      <path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" />
    </svg>
  )
}

function WavesIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  )
}

function WifiIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13a10 10 0 0 1 14 0" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <line x1="12" x2="12.01" y1="20" y2="20" />
    </svg>
  )
}

function WindIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    </svg>
  )
}
