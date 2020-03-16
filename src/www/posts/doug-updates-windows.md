---
tags: posts
layout: pages/post
title: Doug Updates Windows
date: 2020-01-01T12:00:00-08:00
excerpt: Doug updates Windows 10, hilarity ensues.
---

Allow me to tell you a tale, of the greatest #Windows update experience I have ever had.

To set the stage, I run a Windows 10/#Ubuntu #Linux dual boot. Everything is done in a browser these days, so I use Linux for just about everything. I only ever start Windows to play games.

Just last week, #DragonBall #FighterZ released season 3, and I was pumped to play it. I managed to get in about an hour late at night, and went to shut down my computer for the night.

I saw I had a Windows update ready...

Me: What could possibly go wrong?

Narrator: Everything.

I awoke the next morning to a brick, as I would get "error: partition not found" when trying to boot. I couldn't even get to Grub!

I had an old Linux pendrive, so I booted to that and used #GParted to look at the hard drive...

I had previously set up my partitions like so:
* An NTFS partition for Windows (it's C:\ drive).
* An Ext4 partition for Linux (mounted at /)
* Another NTFS for shared data (D:\ drive on Windows, /media/Data on Linux).

I found the Linux-only partition to be unallocated.

AFAICT, Windows ran out of storage space during the update and "borrowed" some from my Linux partition. This seems to have included by Grub configuration, as the boot loader no longer worked.

I tried to recover the partition, but I was unable to boot to Windows **or** Linux.

Fortunately, my Data partition was still intact, so I hadn't lost anything valuable. Eventually I decided recovery wasn't worth the effort, and I would just re-install Windows and Linux from scratch.

Ok, so first step is to just install Windows right? How hard can that be?

First I had to download the .iso image, which turned out to be quite difficult to find. I have an Education edition product key from college, yet that isn't an option on #Microsoft's download page. Instead there is a separate page for Education edition: https://bit.ly/32HyPQD

(This page is also simply not indexed by Google as far as I can tell, I could not get it to appear on any Google search.)

So I finally downloaded the .iso and burned it to a flash drive. Now I just boot to that drive and install Windows right?

Of course not, that would be too easy. Booting to the flash drive would also fail with "error: partition not found".

After many, many, many hours of trial and error, I discovered that this was failing because my flash drive was not formatted with a GPT partition table.

GPT partition tables are apparently necessary for the UEFI BIOS standard. Of course, simply telling me that would be ridiculous, "partition not found" is *definitely* the right error message here.

So I reformatted the drive with a GPT partition table and re-burned the Windows image. Now I'm able to boot to the drive and get to the Windows installer, hooray! (This is now two days later BTW.)

Smooth sailing from here right?

Wrong! Windows installer fails because some media files are missing and I need to include a special driver. How could the Windows installer not have all the files it needs?

Everything I found online just said my installer must be corrupted somehow.

Eventually I discovered that my flash drive was missing an `install.wim` file which was in the .iso installer. Why was this file missing? Because it's 4.3 GB!

My flash drive, like many, was formatted as Fat32 by default. But why would that matter?

Fat32 uses 32-bit file size integers, so it can't hold a single file larger than 2^32 bytes (4GB) large. Unfortunately, the `install.wim` file is slightly too big. Eventually I found [this doc](https://docs.microsoft.com/en-us/windows-hardware/manufacture/desktop/split-a-windows-image--wim--file-to-span-across-multiple-dvds) which talks about splitting a large `.wim` file into multiple `.swm` files. Apparently, Microsoft has a tool called DISM which can split the file. Windows installer is designed to work with this, so it will do the right thing. Of course, DISM is a Windows tool, and I don't have access to a Windows build. Instead, I found [`wimlib`](https://wimlib.net/), which is a Linux tool that can do the same thing. Of course, how to install the tool is not really documented, so I ended up having to clone the source code and build it directly, which is a massive pain in the ass for C code.

After finally installing `wimlib`, I was able to split the `install.wim` file into `install.swm` and `install2.swm`, each under 4 GB. Why Microsoft, already aware of this problem, could not simply ship an installer which can be burned to a generic off-the-shelf flash drive, I do not know. Finally, I am able to boot to the drive, run the Windows installer, and I don't get any media errors.

Instead, I get formatting errors, as I'm unable to choose a partition to install to. It gives a generic "Error" with no helpful information whatsoever. A link in the bottom left shows "Windows can't be installed. (Show details)" and clicking this tells me that the drive must be formatted with a GPT partition table, presumably because I'm trying to install it on a UEFI system. Finally a fucking error message that tells me what's wrong! It was buried under and unrelated help link, but let's not set the bar too high.

Ok well that means I need to reformat the entire drive, including my unrelated Data partition just to get a filesystem Windows will install to. I don't understand why this wasn't a problem before, but I guess Windows only just now decided to care about it. I backed up my Data parition and deleted it, changing the drive to use GPT with GParted. I also took the opportunity to recreate the Windows-only NTFS partition, the Linux-only Ext4 partition, and the shared Data NTFS partition.

I reran Windows installer, went to custom install, picked the new Windows NTFS partition, and saw "We couldn't create a new parition or locate an existing one. For more information, see the Setup log files." I tried reformatting that parition directly in the Windows installer, just to make sure Windows could do literally whatever the fuck it wants, and yet it **still** cannot install itself. It also provides no direction as to where the "Setup log files" are or how I could access them.

Ok, whatever. I'll just do a regular install, don't bother with any fancy partition nonsense for now. I can always resize the partition later. So I went back to do the regular install and I see that it can only do an in-place upgrade, not a fresh install. What is a regular user supposed to do in this situation? At this point, I as a tech-savvy software developer (who has thrown out all attempts at dual-booting Linux for now as I'll just deal with that later) **am literally unable to install fucking Windows!**

At this point, the error message should just say "Haha, fuck you!".

After a lot of Googling, I found that log files are typically in store in `C:\Windows\panther`, only problem is that drive doesn't exist because Windows isn't installed yet! The installer doesn't provide a means of exporting log files to another flash drive, and I have no idea what partition it would arbitrairly decide to be the `C:\` drive. After further researching, I came across the magic hotkey of `Shift+F10`, which opens up a command prompt even during the installer. This at least lets me peek around and look for logs. Turns out `C:\` does exist (I have no idea which physical storage device those files are being saved to). I found `C:\Windows\panther\setupact.log` which includes some interesting errors such as:

```
Volume at disk [0] offset [0x0] doesn't meet criteria for system volumes...
LogReasons: [BLOCKING reason for {disk 0 offset 0x0}: CanBeSystemVolume] The parition is too small.
```

The partition is 150 GB, so I don't know what Windows is complaining about here. Maybe GParted did something Windows didn't expect, so I used `diskpart` in the Windows command prompt to clean the entire disk and create a single new primary partition. Trying to pick that drive again fails with the same cryptic display message and logs files containing roughly equivalent info. I ran `chkdsk` on all available partitions but it didn't find anything concerning either. I formatted the new partition as NTFS, but this had no observable effect.

[Next idea to try](https://forums.tomshardware.com/threads/cant-install-os-on-ssd.2527192/post-16413262) was to copy all the files from the USB drive directly onto the hard drive and then boot to that drive rather than the USB. I had to find the relevant partition in `diskpart` and manually mount it onto a new label (`Z:\`). I also had to identify the drive letter assigned to the USB drive (`E:\`). Then from the Windows shell I did:

```shell
xcopy /E E:\ Z:\
```

Rebooting to the hard drive then blue screened with a BCD error (screenshot). That led be down the rabbit hole of what the hell BCD is and why I should care. This is apprently an extra partition created by Windows which contains boot configuration data. I had seen this partition before in my previous builds, though never fully understood what it was and generally didn't mess with it. Perhaps Windows just isn't creating this parition, or is trying to and doesn't have any additional space to do so because my NTFS partition takes up the whole drive? https://social.technet.microsoft.com/Forums/windows/en-US/53fd067f-63d6-4c53-aa5a-7ceae63a0c4e/create-bootable-partitioning-with-diskpart?forum=w7itproinstall

So I used `diskpart` to delete the existing NTFS partition on the drive. Then I created a 500MB NTFS partition for the system and put the remaining space in a spearate NTFS partition.

```shell
diskpart
> create partition primary size=100
> select partition 1
> format fs=ntfs label="System" quick
> assign letter S
> create partition primary
> format fs=ntfs label="Windows" quick
> assign letter C
> exit
```

Then I copied over the install files to the Windows partition and attempted to reload the BCD configuration onto the new system partition.

```shell
xcopy /E E:\ C:\
bcdboot C:\Windows /s S:\
```

However I get "Failure when attempting to copy boot files." which is **very** specific and helpful error message. Eventually I realized that I was trying to copy from `C:\` which now contains the install files (and doesn't have a `Windows\` directory). I tried again using the `X:\` drive which I guess contains files extracted from the installer bundle in order to actually run the install process? IDHAFC.

```shell
bcdboot X:\Windows /s S:\
```

And now I get the error:

> BFSVC Error: Failed to set element application device. Status = [c00000bb]
> BFSVC Error: Failed to populate BCD store. Status = [c00000bb]

I also tried formatting the system partition as FAT, as I read that may be required in some circumstances, but `bcdboot` still resulted in the same error.

Continuing with the theory that perhaps it can't allocate a system partition because the NTFS partition takes up the whole space, I decided to delete all partitions on the drive and rerun the set up flow. So once more:

```shell
diskpart
> list disk
> select disk 0
> select volume 0
> delete volume
> select volume 1
> delete volume
> exit
```

I refreshed the devices listed in the Windows installer and Disk 0 was listed as "Unallocated". I installed on that disk and suddenly Windows **actually installed**. Hallehluah!

So I got into this mess because Windows update corrupted an unrelated Linux partition, yet I was unable to reinstall Windows because there was no unallocated space? When it asked where to install Windows, I picked the empty NTFS drive, so if you wanted an unallocated space, why did you list the NTFS drive as an option!?!? This problem first occured on a Saturday morning, and I've been working throughout the week. I've finally got this fixed on Friday evening, where my computer has been unusable for that entire time period!
