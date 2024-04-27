export const AllDrivers: DriverConfig[] = [
  {
    path: "Ark", // should be unique for each driver , space not allowed ,
    type: "onedrive",
    refreshtoken:
      "0.AVIASKg0_MHWWUmeGiwhF6r5ojzDQ1_NZgFOnTzp-2O4GUa6AKM.AgABAwEAAADnfolhJpSnRYB1SVj-Hgd8AgDs_wUA9P9vxHv9js04V5DCrm5ic8jnaOWyV2yllDHRFBwWIpfqhecV9VqG0L3QBXFA66PR9-mt9R7sVYEIq7DL0iw7ENnJ7G_yKFielIQ5KOP0B7JnZ6vvL3Djqo-9jpHEG8K8v_0t4AtiajEwP8gl-ISYB5hYHA4gB3T1geeCYRaByhkKtE6K_GN6yWj4pAJnwue_JUiDfh6N_MAiF9o9fIeRTuNoyR3PY5hu3Q5YKIXsLYU0sLVz30spoOzhi9LHiGYsCsGLPkwsqjTH5unhrE-6ubmxoanNhM_8DLtIZfU61ZOnVsNS7naojSuWsoA-XvDNlcztquISHqkvzfE_WeOw4Pxmtues02dCA7b7JC4Pre9AOCde-16-EfpSy75zHOEJbfJcoC6ASz1odjEvd4i21qrUL8o5f-DQlzhgtyc43YVaRufGfeOsrGyp3z9GEkdnVugBJ8fETYmPhlNRaTtwlZc_x5TzIOUmgmhjZ6lnTver-l0wRgrUtEduJ7Wm1tbi4f9xDQMRNe1xiLdSrO0lBTykZ2bTPNdTBMTogHzMTgiDWWBiyQyWIf4NkICVjTs-2r6mytHPH04skk2dp6Ju9JIz5CII-kgjepHIiVO3WRLjfn0oQBUTRVnHikKIn87k8tYqXoOurfSqooaoFHrtXJKLoTmS-4ehiapg-3Jl3RWhxaDuhjstpFMl9cU4YGsD5EY2H7FjUD6vTRxRrSvhAW5qcfBW8xe-isdvzmBhpw0mrUq32xfWxLNxEgTwzYpTBB5JcZ64HmxEKxfz52lJy1N61TS7dxse93p0sscbB7hGUADMZBgqbTUDTzb-nP1EeN-o",
  },
];

// __ Dot Touch __ if you don't know what you are doing below
interface DriverIF {
  List(id?: string): Promise<DriveList[]>; // id is optional
  Search(name: string): Promise<DriveList[]>;

  GetFile(id: string, request: any): Promise<Response>;
}

export interface DriveList {
  name: string;
  id: string;
  size: number;
  type: string;
}

interface DriverConfig {
  path: string;
  type: "onedrive" | "googledrive";
  refreshtoken: string;
}

//  get driver by path
export function GetDriver(path: string): DriverIF {
  const driver = AllDrivers.find((d) => {
    return d.path === path;
  });
  if (!driver) {
    throw new Error("Driver not found");
  }

  switch (driver.type) {
    case "onedrive":
      return new OneDrive(driver.refreshtoken);
    case "googledrive":
      return new GDrive(driver.refreshtoken);
    default:
      throw new Error("Driver not found");
  }
}

class OneDrive implements DriverIF {
  private accessToken: string;
  private readonly refreshToken: string;

  constructor(refreshToken: string) {
    this.refreshToken = refreshToken;
  }

  private async loadToken() {
    try {
      const token = await this.fetchAccessToken(this.refreshToken);
      this.accessToken = token;
      return token;
    } catch (error) {
      console.log("error", error);
      throw new Error("Error fetching access token");
    }
  }

  private async fetchAccessToken(refreshToken: string): Promise<string> {
    // this.accesstoken =   (refreshToken):string => {
    const client_id = "5f43c33c-66cd-4e01-9d3c-e9fb63b81946";
    const client_secret = "Lbv8Q~k_v-XzDy.M2xZS5bFlCqS4bdJKS-mPfam7";
    const redirect_uri = "https://alist.nn.ci/tool/onedrive/callback";
    const token_url =
      "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    const req = await fetch(token_url, {
      method: "POST",
      body: `client_id=${client_id}&scope=offline_access%20Files.ReadWrite.All&refresh_token=${refreshToken}&redirect_uri=${redirect_uri}&grant_type=refresh_token&client_secret=${client_secret}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const data = await req.json();
    this.accessToken = data.access_token;

    return data.access_token;
  }

  async List(id?: string): Promise<DriveList[]> {
    if (!this.accessToken) {
      await this.loadToken();
    }
    let url = "";
    if (id) {
      url = `https://graph.microsoft.com/v1.0/me/drive/items/${id}/children?$top=5000&$expand=thumbnails($select=medium)&$select=id,name,size,lastModifiedDateTime,content.downloadUrl,file,parentReference`;
    } else {
      url =
        "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=5000&$expand=thumbnails($select=medium)&$select=id,name,size,lastModifiedDateTime,content.downloadUrl,file,parentReference";
    }
    const request = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const data = await request.json();

    return data.value.map((item: any) => {
      return {
        name: item.name,
        size: item.size,
        id: item.id,
        type: item.file ? "file" : "folder",
      };
    });
  }

  async GetFile(id: string, request: any): Promise<Response> {
    if (!this.accessToken) {
      await this.loadToken();
    }
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${id}/content`;
    const myheaders = {
      Authorization: `Bearer ${this.accessToken}`,
    };
    try {
      if (request.headers.get("Range" || "range")) {
        console.log("got partial content request");
        myheaders["Range"] = request.headers.get("Range" || "range");
        const response = await fetch(url, { headers: myheaders });
        const contentRange = response.headers.get("Content-Range");
        const contentLength = response.headers.get("Content-Length");
        const disposition = response.headers.get("content-disposition");
        const filename = decodeURIComponent(
          disposition
            .substring(disposition.indexOf("utf-8") + 7)
            .replace(/['"]/g, "")
            .replace(";", "")
            .replace("filename=", "")
        );
        return new Response(response.body, {
          status: 206, // Partial Content
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Range": contentRange,
            "Content-Length": contentLength,
            "Accept-Ranges": "bytes",
          },
        });
      } else {
        const Head = new Headers();
        Head.set("Authorization", `Bearer ${this.accessToken}`);
        try {
          return await fetch(url, { headers: Head });
        } catch (error) {
          return new Response("api limited, cant handle request ", {
            status: 500,
          });
        }
      }
    } catch (error) {
      return new Response("api limited, cant handle request ", {
        status: 500,
      });
    }
  }

  Search(name: string): Promise<DriveList[]> {
    return Promise.resolve([]);
  }
}

class GDrive implements DriverIF {
  public token: string;

  constructor(token: string) {
    this.token = token;
  }

  async List(id?: string): Promise<DriveList[]> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${id}/root/children`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );
    const data = await response.json();
    return data.value;
  }

  async GetFile(id: string, request: any): Promise<Response> {
    return new Response("Not implemented");
  }

  async Search(name: string): Promise<DriveList[]> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${name}')`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );
    const data = await response.json();
    return data.value;
  }
}
