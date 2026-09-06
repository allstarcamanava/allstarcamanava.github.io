module Jekyll
  class PartnersGenerator < Generator
    safe true

    def generate(site)
      partners = site.data["partners"]["partners"]

      return unless partners.is_a?(Array)

      partners.each do |partner|
        name = partner["name"].to_s.strip
        next if name.empty?

        slug = name.downcase
                    .gsub("&", "and")
                    .gsub(/[^a-z0-9\s-]/, "")
                    .strip
                    .gsub(/\s+/, "-")
                    .gsub(/-+/, "-")

        site.pages << PartnerPage.new(
          site,
          site.source,
          "partners",
          slug,
          partner
        )
      end
    end
  end

  class PartnerPage < Page
    def initialize(site, base, dir, slug, partner)
      @site = site
      @base = base
      @dir = File.join(dir, slug)
      @name = "index.html"

      self.process(@name)

      self.read_yaml(
        File.join(base, "_layouts"),
        "partner.html"
      )

      self.data["partner_name"] = partner["name"]
      self.data["logo"] = partner["logo"]
      self.data["website"] = partner["website"]
      self.data["roles"] = partner["roles"]
      self.data["description"] = partner["description"]

      self.data["title"] = partner["name"]
      self.data["permalink"] = "/partners/#{slug}/"
    end
  end
end
